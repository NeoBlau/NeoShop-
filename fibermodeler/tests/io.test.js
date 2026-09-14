import { assert, test } from './harness.js';
import { createDiagram, createEdge, createNode, createProject, Doc } from '../app/core/model.js';
import { bytesToText, createZip, crc32, readZip } from '../app/io/zip.js';
import { findAll, findFirst, parseXml, textOf, XmlWriter, escapeXml } from '../app/io/xml.js';
import { exportBpmnXml, importBpmnXml } from '../app/io/bpmn.js';
import { packProject, projectFromJson, projectToJson, unpackProject } from '../app/io/projectfile.js';
import { exportDiagramSvg, inlineCssVars } from '../app/io/svgexport.js';
import { buildPdf, pageSize, svgToContent, svgToPdf, PAGE_SIZES } from '../app/io/pdf.js';
import { safeFileName } from '../app/io/files.js';
import { createDemoProject } from '../app/demo.js';

function sampleDiagram() {
  const diagram = createDiagram({ notation: 'bpmn', name: 'Обработка заказа' });
  diagram.nodes.push(createNode({ id: 'pool1', type: 'pool', x: 0, y: 0, w: 800, h: 300, label: 'Магазин' }));
  diagram.nodes.push(createNode({ id: 'start', type: 'startMessageEvent', x: 60, y: 60, w: 36, h: 36, label: 'Заказ получен', parent: 'pool1' }));
  diagram.nodes.push(createNode({ id: 'task', type: 'userTask', x: 200, y: 40, w: 130, h: 84, label: 'Проверить заказ', parent: 'pool1', props: { documentation: 'Менеджер сверяет позиции' } }));
  diagram.nodes.push(createNode({ id: 'gw', type: 'exclusiveGateway', x: 400, y: 55, w: 50, h: 50, label: 'Оплачено?', parent: 'pool1' }));
  diagram.nodes.push(createNode({ id: 'end', type: 'endEvent', x: 600, y: 60, w: 36, h: 36, label: 'Готово', parent: 'pool1' }));
  diagram.edges.push(createEdge({ id: 'f1', type: 'sequenceFlow', source: 'start', target: 'task' }));
  diagram.edges.push(createEdge({ id: 'f2', type: 'sequenceFlow', source: 'task', target: 'gw' }));
  diagram.edges.push(createEdge({ id: 'f3', type: 'sequenceFlow', source: 'gw', target: 'end', label: 'да', props: { condition: 'paid == true' } }));
  return diagram;
}

test('zip round trip with unicode names and deflate', async () => {
  const blob = await createZip([
    { name: 'project.json', data: JSON.stringify({ имя: 'Проект', n: 1 }) },
    { name: 'models/bpmn/d1.json', data: 'x'.repeat(4000) },
  ]);
  const files = await readZip(await blob.arrayBuffer());
  assert.equal(files.size, 2);
  assert.deepEqual(JSON.parse(bytesToText(files.get('project.json'))), { имя: 'Проект', n: 1 });
  assert.equal(bytesToText(files.get('models/bpmn/d1.json')).length, 4000);
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('XML parser handles namespaces, entities, CDATA and comments', () => {
  const doc = parseXml(`<?xml version="1.0"?>
    <bpmn:definitions xmlns:bpmn="x">
      <!-- comment -->
      <bpmn:process id="p1" name="Процесс &amp; сервис">
        <bpmn:documentation><![CDATA[Любой <текст>]]></bpmn:documentation>
        <bpmn:task id="t1"/>
      </bpmn:process>
    </bpmn:definitions>`);
  const process = findFirst(doc, 'process');
  assert.equal(process.attrs.id, 'p1');
  assert.equal(process.attrs.name, 'Процесс & сервис');
  assert.equal(textOf(findFirst(doc, 'documentation')), 'Любой <текст>');
  assert.equal(findAll(doc, 'task').length, 1);
  assert.equal(escapeXml('a<b'), 'a&lt;b');
  const writer = new XmlWriter({ declaration: false });
  writer.open('a', { x: 1 }).leaf('b', {}, 'текст').close();
  assert.includes(writer.toString(), '<b>текст</b>');
});

test('BPMN 2.0 export produces a valid document with DI', () => {
  const xml = exportBpmnXml(sampleDiagram());
  for (const marker of [
    'bpmn:definitions', 'xmlns:bpmndi', 'bpmn:collaboration', 'bpmn:participant', 'bpmn:process',
    'bpmn:startEvent', 'bpmn:messageEventDefinition', 'bpmn:userTask', 'bpmn:exclusiveGateway',
    'bpmn:sequenceFlow', 'bpmn:conditionExpression', 'bpmndi:BPMNShape', 'bpmndi:BPMNEdge', 'di:waypoint', 'dc:Bounds',
  ]) {
    assert.includes(xml, marker);
  }
  assert.includes(xml, 'Проверить заказ');
});

test('BPMN round trip keeps types, labels, geometry and flows', () => {
  const original = sampleDiagram();
  const xml = exportBpmnXml(original);
  const { diagram, hasLayout } = importBpmnXml(xml);
  assert.equal(hasLayout, true);
  assert.equal(diagram.nodes.length, original.nodes.length);
  assert.equal(diagram.edges.length, original.edges.length);
  const types = diagram.nodes.map((n) => n.type).sort();
  assert.deepEqual(types, ['endEvent', 'exclusiveGateway', 'pool', 'startMessageEvent', 'userTask'].sort());
  const task = diagram.nodes.find((n) => n.type === 'userTask');
  assert.equal(task.label, 'Проверить заказ');
  assert.equal(task.x, 200);
  assert.equal(task.props.documentation, 'Менеджер сверяет позиции');
  const conditional = diagram.edges.find((e) => e.props?.condition);
  assert.equal(conditional.props.condition, 'paid == true');
  assert.equal(diagram.nodes.find((n) => n.type === 'pool').label, 'Магазин');
});

test('importing foreign BPMN without DI still yields a model', () => {
  const foreign = `<?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" id="d">
      <process id="Process_1">
        <startEvent id="S" name="Start"/>
        <serviceTask id="T" name="Call service"/>
        <endEvent id="E" name="Done"/>
        <sequenceFlow id="F1" sourceRef="S" targetRef="T"/>
        <sequenceFlow id="F2" sourceRef="T" targetRef="E"/>
      </process>
    </definitions>`;
  const { diagram, hasLayout } = importBpmnXml(foreign);
  assert.equal(hasLayout, false);
  assert.equal(diagram.nodes.length, 3);
  assert.equal(diagram.edges.length, 2);
  assert.equal(diagram.nodes.find((n) => n.id === diagram.edges[0].source).type, 'startEvent');
  assert.equal(diagram.nodes.some((n) => n.type === 'serviceTask'), true);
});

test('project file packs and unpacks with every diagram', async () => {
  const project = createDemoProject('ru');
  const blob = await packProject(project);
  const restored = await unpackProject(await blob.arrayBuffer());
  assert.equal(restored.name, project.name);
  assert.equal(restored.diagrams.length, project.diagrams.length);
  for (let i = 0; i < project.diagrams.length; i++) {
    assert.equal(restored.diagrams[i].nodes.length, project.diagrams[i].nodes.length);
    assert.equal(restored.diagrams[i].edges.length, project.diagrams[i].edges.length);
    assert.equal(restored.diagrams[i].name, project.diagrams[i].name);
  }
  const child = restored.diagrams.find((d) => d.parentNodeId);
  assert.ok(child, 'the decomposition link survives');
  assert.ok(restored.diagrams.some((d) => d.id === child.parentDiagramId));
});

test('project JSON round trip', () => {
  const project = createDemoProject('en');
  const restored = projectFromJson(projectToJson(project));
  assert.equal(restored.diagrams.length, project.diagrams.length);
  assert.equal(restored.documentation, project.documentation);
});

test('SVG export is self contained and has no CSS variables left', () => {
  const doc = new Doc(createProject({}));
  const diagram = sampleDiagram();
  doc.addDiagram(diagram);
  const svg = exportDiagramSvg(diagram, doc, {});
  assert.includes(svg, '<svg');
  assert.includes(svg, 'viewBox');
  assert.equal(/var\(--/.test(svg), false, 'variables must be inlined');
  assert.includes(svg, 'Проверить заказ');
  assert.includes(svg, '</svg>');
  assert.equal(inlineCssVars('fill="var(--task-fill)"'), 'fill="#ffffff"');
});

test('PDF export produces a valid single page document with embedded text', () => {
  const doc = new Doc(createProject({}));
  const diagram = sampleDiagram();
  doc.addDiagram(diagram);
  const svg = exportDiagramSvg(diagram, doc, {});
  const { content, builder } = svgToContent(svg, { x: 0, y: 0, width: 800, height: 500, pageHeight: 500 });
  assert.ok(content.includes(' re') || content.includes(' m'), 'path operators are emitted');
  assert.includes(content, 'BT');
  assert.includes(content, 'Tj');
  assert.ok(builder.glyphs.size > 5, 'glyphs are collected for the embedded font');
  const pdf = buildPdf([{ width: 842, height: 595, content, alphas: builder.alphas, glyphs: builder.glyphs }], { title: 'Тест' });
  assert.ok(pdf.size > 20000);
});

test('PDF page sizes and helpers', () => {
  assert.deepEqual(pageSize('A4', 'landscape'), { width: PAGE_SIZES.A4[1], height: PAGE_SIZES.A4[0] });
  assert.deepEqual(pageSize('A3', 'portrait'), { width: PAGE_SIZES.A3[0], height: PAGE_SIZES.A3[1] });
  assert.ok(PAGE_SIZES.A0[0] > PAGE_SIZES.A1[0]);
});

test('PDF bytes start with a header and end with the trailer', async () => {
  const doc = new Doc(createProject({}));
  const diagram = sampleDiagram();
  doc.addDiagram(diagram);
  const blob = svgToPdf(exportDiagramSvg(diagram, doc, {}), { pageSize: 'A4', orientation: 'landscape', header: 'Тест' });
  const text = Buffer.from(await blob.arrayBuffer()).toString('latin1');
  assert.ok(text.startsWith('%PDF-1.7'));
  assert.includes(text, '/Type /Catalog');
  assert.includes(text, '/Identity-H');
  assert.includes(text, 'startxref');
  assert.ok(text.trimEnd().endsWith('%%EOF'));
});

test('export file names stay portable', () => {
  assert.equal(safeFileName('Обработка заказа', '.pdf'), 'Obrabotka zakaza.pdf');
  assert.equal(safeFileName('a/b:c', '.svg'), 'a-b-c.svg');
  assert.equal(safeFileName('', '.png'), 'diagram.png');
});
