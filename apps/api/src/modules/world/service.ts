import type {
  ProductInteractionDto,
  WorldModelLevel,
  WorldPavilion,
  WorldProduct,
  WorldResponse,
} from '@3dsfera/shared';
import type { Db } from '../../lib/prisma.js';
import { publicUrl } from '../../lib/storage.js';

/**
 * The public read model of the world.
 *
 * Everything here is anonymous: no session, no personal data, and only
 * published products from approved suppliers. It is also the hottest endpoint
 * in the application, so it returns exactly what the scene needs to place and
 * stream a pavilion, and nothing else.
 */

/** Metres between pavilion centres. Wide enough that two halls never overlap. */
export const PAVILION_SPACING = 34;

interface AssetRow {
  kind: string;
  storageKey: string;
  byteSize: number;
  lodLevel: number | null;
  meta: unknown;
}

function toLevels(assets: AssetRow[]): WorldModelLevel[] {
  return assets
    .filter((asset) => asset.kind === 'GLB_OPTIMIZED' && asset.lodLevel !== null)
    .map((asset) => ({
      level: asset.lodLevel ?? 0,
      url: publicUrl(asset.storageKey),
      byteSize: asset.byteSize,
      triangles: (asset.meta as { triangles?: number } | null)?.triangles ?? 0,
    }))
    .sort((a, b) => a.level - b.level);
}

export async function loadWorld(db: Db): Promise<WorldResponse> {
  const pavilions = await db.pavilion.findMany({
    where: {
      status: 'PUBLISHED',
      supplier: { status: 'APPROVED' },
    },
    orderBy: { slot: 'asc' },
    select: {
      id: true,
      slot: true,
      title: true,
      theme: true,
      worldPosition: true,
      supplier: { select: { companyName: true } },
      products: {
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          priceCents: true,
          currency: true,
          stock: true,
          assets: {
            select: {
              kind: true,
              storageKey: true,
              byteSize: true,
              lodLevel: true,
              meta: true,
            },
          },
          interactions: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              type: true,
              clipName: true,
              label: true,
              labelEn: true,
              order: true,
              loop: true,
              config: true,
            },
          },
        },
      },
    },
  });

  return {
    pavilionSpacing: PAVILION_SPACING,
    pavilions: pavilions.map((pavilion): WorldPavilion => {
      const position = pavilion.worldPosition as {
        x?: number;
        y?: number;
        z?: number;
        rotationY?: number;
      } | null;

      const products: WorldProduct[] = pavilion.products
        .map((product, index): WorldProduct => {
          const preview = product.assets.find((asset) => asset.kind === 'PREVIEW');

          return {
            id: product.id,
            slug: product.slug,
            title: product.title,
            description: product.description,
            priceCents: product.priceCents,
            currency: product.currency,
            stock: product.stock,
            previewUrl: preview ? publicUrl(preview.storageKey) : null,
            levels: toLevels(product.assets),
            interactions: product.interactions.map((interaction): ProductInteractionDto => ({
              ...interaction,
              config: (interaction.config as ProductInteractionDto['config']) ?? null,
            })),
            standIndex: index,
          };
        })
        // A product whose model has not finished processing has nothing to
        // stand on a plinth; it stays in the flat catalogue until it does.
        .filter((product) => product.levels.length > 0);

      return {
        id: pavilion.id,
        slot: pavilion.slot,
        title: pavilion.title,
        theme: pavilion.theme,
        supplierName: pavilion.supplier.companyName,
        worldPosition: {
          x: position?.x ?? (pavilion.slot - 1) * PAVILION_SPACING,
          y: position?.y ?? 0,
          z: position?.z ?? 0,
          rotationY: position?.rotationY ?? 0,
        },
        products,
      };
    }),
  };
}

/**
 * Counts a product view.
 *
 * Fire-and-forget on purpose: a failed counter must never break a scene the
 * buyer is standing in. Deduplication is the client's job — it reports a view
 * once per product per session, when the buyer actually opens the panel.
 */
export async function recordProductView(db: Db, productId: string): Promise<void> {
  await db.product
    .update({ where: { id: productId }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);
}
