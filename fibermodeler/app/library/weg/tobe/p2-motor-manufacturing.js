/**
 * 2 (TO-BE). Motor line with vertical integration, in-line testing and
 * statistical process control instead of end-of-line sorting.
 */
import { DERIVED, WEG, dataNote, roles, sourceBlock } from '../facts.js';
import { auto, flow, node, reported, work } from '../../kit.js';

const LANES = [
  { id: 'plan', label: { ru: 'Планирование производства', en: 'Production planning' } },
  { id: 'stamp', label: { ru: 'Штамповка и пакетирование', en: 'Stamping and stacking' } },
  { id: 'rotor', label: { ru: 'Литьё ротора и механообработка', en: 'Rotor casting and machining' } },
  { id: 'wind', label: { ru: 'Автоматическая обмотка и изоляция', en: 'Automated winding and insulation' } },
  { id: 'assy', label: { ru: 'Сборка', en: 'Assembly' } },
  { id: 'test', label: { ru: 'Встроенные испытания (IEC 60034)', en: 'In-line testing (IEC 60034)' } },
  { id: 'finish', label: { ru: 'Окраска и упаковка', en: 'Painting and packing' } },
];

export const motorManufacturingToBe = {
  id: 'weg-make-motor-tobe',
  order: 2,
  variant: 'to-be',
  baselineId: 'weg-make-motor',
  name: {
    ru: '2. Производство асинхронного двигателя — как будет',
    en: '2. Induction motor manufacturing — to be',
  },
  description: {
    ru: 'Вертикальная интеграция по проводу и литью, автоматическая намотка, встроенный контроль изоляции вместо отдельного поста, статистический контроль процесса вместо сортировки на выходе, порошковая окраска без длительной полимеризации.',
    en: 'Vertical integration on wire and casting, automated winding, in-line insulation testing instead of a separate station, statistical process control instead of end-of-line sorting, powder painting without a long cure.',
  },
  analysis: {
    currency: 'R$',
    volumePerYear: WEG.motorsPerYear,
    hoursPerFte: 1800,
    workingDays: WEG.workingDays,
    roles: roles('Планировщик', 'Оператор', 'Намотчик', 'Сборщик', 'Техник-испытатель', 'ОТК'),
  },
  documentation: {
    ru: `Целевое состояние маршрута одного двигателя по линии.

Опирается на публично объявленное направление инвестиций WEG:
• около R$ ${(WEG.investments.verticalizationBrl / 1e6).toFixed(0)} млн в вертикальную интеграцию в Мексике и Бразилии — собственные переделы вместо покупных;
• R$ ${(WEG.investments.capacityBrl3y / 1e9).toFixed(1)} млрд в расширение мощностей;
• базовый объём расчёта не меняется: ${(WEG.motorsPerYear / 1e6).toFixed(0)} млн двигателей в год, ${DERIVED.motorsPerDay.toLocaleString('ru-RU')} в день (публичная отчётность 2025).

Что меняется по сравнению с «как есть»:
1. **Намотка.** Ручная намотка катушек заменена автоматической на массовых типоразмерах: 6 мин → 3,2 мин, намотчик обслуживает несколько станков.
2. **Контроль изоляции.** Импульсный тест встроен в линию сразу после укладки, а не отдельным постом: 1,2 → 0,5 мин, и дефект ловится до пропитки, поэтому доля перемоток падает с 3 до 1,2 %.
3. **Пропитка.** УФ-полимеризация вместо печи: межоперационное ожидание 40 → 12 мин.
4. **Выходной контроль.** Добавлен статистический контроль процесса по телеметрии линии — отклонение видно до испытаний, доля несоответствий по КПД падает с 2,5 до 1 %.
5. **Окраска.** Порошковое покрытие вместо жидкого: ожидание 25 → 8 мин.
6. **Материал.** Собственный обмоточный провод и алюминиевое литьё снижают материальную составляющую штамповки, литья и обмотки.

Что НЕ меняется: требования IEC 60034, состав операций сборки, выборочные типовые испытания партии.

Целевые нормативы времени — **отраслевые допущения**: WEG не публикует пооперационных нормативов. Их нужно заменить данными MES перед принятием решений.

${dataNote('ru')}

${sourceBlock(['verticalization', 'production', 'numbers'], 'ru')}`,
    en: `Target state of a single motor's route through the line, anchored on WEG's publicly announced direction: about R$ ${(WEG.investments.verticalizationBrl / 1e6).toFixed(0)}m into vertical integration in Mexico and Brazil and R$ ${(WEG.investments.capacityBrl3y / 1e9).toFixed(1)}bn into capacity. The volume is unchanged: ${(WEG.motorsPerYear / 1e6).toFixed(0)} million motors a year.

Changes: automated coil winding (6 → 3.2 min); the surge test moves in-line right after insertion (1.2 → 0.5 min) and catches the fault before impregnation, so rewinds drop from 3% to 1.2%; UV curing replaces the oven (40 → 12 min of queue); statistical process control on line telemetry cuts efficiency-class failures from 2.5% to 1%; powder coating replaces wet paint (25 → 8 min); own winding wire and aluminium casting reduce the material content.

Unchanged: the IEC 60034 requirements, the assembly content and the batch type tests.

The target times are **assumptions** - replace them with MES data before deciding anything.

${dataNote('en')}

${sourceBlock(['verticalization', 'production', 'numbers'], 'en')}`,
  },
  spec: {
    notation: 'bpmn',
    name: { ru: 'Производство двигателя — как будет', en: 'Motor manufacturing — to be' },
    lanes: LANES,
    nodes: [
      node('start', 'startTimerEvent', 'plan', 'Производственный заказ по плану MPS', 'Production order from the MPS', reported({})),
      node('release', 'serviceTask', 'plan', 'Выпустить заказ автоматически по сигналу линии', 'Release the order automatically on the line signal', auto(0.4)),
      node('split', 'parallelGateway', 'plan', 'Запустить ветки', 'Start the branches'),
      node('stampStator', 'manualTask', 'stamp', 'Штамповать пластины статора и ротора', 'Stamp the stator and rotor laminations', work(0.5, 'Оператор', { cost: 17 })),
      node('stack', 'serviceTask', 'stamp', 'Собрать и скрепить пакет статора на автомате', 'Stack and bond the core automatically', work(0.8, 'Оператор')),
      node('cast', 'serviceTask', 'rotor', 'Литьё ротора из собственного алюминия', 'Rotor casting from in-house aluminium', work(1.3, 'Оператор', { cost: 21 })),
      node('shaft', 'serviceTask', 'rotor', 'Обточить вал и напрессовать ротор', 'Turn the shaft and press on the rotor', work(2, 'Оператор')),
      node('balance', 'serviceTask', 'rotor', 'Автоматическая балансировка', 'Automated balancing', work(0.7, 'Техник-испытатель')),
      node('coil', 'serviceTask', 'wind', 'Намотать катушки на автоматической линии', 'Wind the coils on the automated line', work(3.2, 'Намотчик', { cost: 27 })),
      node('insert', 'manualTask', 'wind', 'Уложить обмотку и изолировать пазы', 'Insert the winding and insulate the slots', work(2.8, 'Намотчик')),
      node('surge', 'serviceTask', 'wind', 'Встроенный импульсный тест межвитковой изоляции', 'In-line surge test of the turn insulation', auto(0.5)),
      node('gwWind', 'exclusiveGateway', 'wind', 'Обмотка годна?', 'Winding sound?'),
      node('rewind', 'manualTask', 'wind', 'Перемотать до пропитки', 'Rewind before impregnation', work(8, 'Намотчик', { cost: 24 })),
      node('impreg', 'serviceTask', 'wind', 'Пропитка с УФ-полимеризацией', 'Impregnation with UV curing', work(1.5, 'Оператор', { waitTime: 12 })),
      node('join', 'parallelGateway', 'assy', 'Синхронизировать ветки', 'Synchronise the branches'),
      node('assemble', 'manualTask', 'assy', 'Собрать двигатель (щиты, подшипники, клеммная коробка)', 'Assemble the motor (end shields, bearings, terminal box)', work(5.5, 'Сборщик', { cost: 42 })),
      node('nameplate', 'serviceTask', 'assy', 'Нанести шильд и серийный номер лазером', 'Laser-mark the nameplate and serial number', auto(0.3)),
      node('spc', 'businessRuleTask', 'test', 'Статистический контроль процесса по телеметрии линии', 'Statistical process control on line telemetry', auto(0.2)),
      node('gwSpc', 'exclusiveGateway', 'test', 'Процесс в допуске?', 'Process within limits?'),
      node('adjust', 'userTask', 'test', 'Подстроить параметры линии', 'Adjust the line parameters', work(14, 'Техник-испытатель')),
      node('routine', 'userTask', 'test', 'Приёмо-сдаточные испытания по IEC 60034-1', 'Routine tests to IEC 60034-1', work(2.6, 'Техник-испытатель')),
      node('gwTest', 'exclusiveGateway', 'test', 'Соответствует классу КПД?', 'Efficiency class met?'),
      node('repair', 'userTask', 'test', 'Дефектовка и устранение', 'Fault finding and repair', work(20, 'Техник-испытатель', { cost: 58 })),
      node('gwRepair', 'exclusiveGateway', 'test', 'Ремонт возможен?', 'Repairable?'),
      node('scrap', 'endErrorEvent', 'test', 'Брак списан', 'Scrapped'),
      node('sample', 'userTask', 'test', 'Выборочные типовые испытания партии', 'Batch type tests on a sample', work(0.3, 'ОТК')),
      node('paint', 'serviceTask', 'finish', 'Порошковая окраска корпуса', 'Powder-coat the frame', work(1.4, 'Оператор', { waitTime: 8, cost: 10 })),
      node('pack', 'manualTask', 'finish', 'Упаковать и передать на склад', 'Pack and move to the warehouse', work(1, 'Оператор', { cost: 8 })),
      node('end', 'endEvent', 'finish', 'Двигатель на складе готовой продукции', 'Motor in finished goods', { completes: true }),
      node('specData', 'dataObject', 'plan', 'Спецификация и маршрутная карта', 'Specification and routing'),
      node('passport', 'dataStore', 'test', 'Цифровой паспорт двигателя (протоколы и телеметрия)', 'Digital motor passport (test records and telemetry)'),
      node('note', 'textAnnotation', 'wind', 'Контроль изоляции перенесён до пропитки: дефект ловится, пока его ещё можно исправить', 'Insulation testing moved before impregnation: the fault is caught while it is still fixable'),
    ],
    edges: [
      flow('start', 'release'),
      flow('release', 'split'),
      flow('split', 'stampStator'),
      flow('split', 'coil'),
      flow('stampStator', 'stack'),
      flow('stack', 'cast'),
      flow('cast', 'shaft'),
      flow('shaft', 'balance'),
      flow('balance', 'join'),
      flow('coil', 'insert'),
      flow('insert', 'surge'),
      flow('surge', 'gwWind'),
      flow('gwWind', 'impreg', { share: 98.8, ru: 'годна', en: 'sound' }),
      flow('gwWind', 'rewind', { share: 1.2, ru: 'дефект', en: 'faulty' }),
      flow('rewind', 'surge'),
      flow('impreg', 'join'),
      flow('join', 'assemble'),
      flow('assemble', 'nameplate'),
      flow('nameplate', 'spc'),
      flow('spc', 'gwSpc'),
      flow('gwSpc', 'routine', { share: 98, ru: 'в допуске', en: 'within limits' }),
      flow('gwSpc', 'adjust', { share: 2, ru: 'дрейф', en: 'drifting' }),
      flow('adjust', 'routine'),
      flow('routine', 'gwTest'),
      flow('gwTest', 'sample', { share: 99, ru: 'годен', en: 'pass' }),
      flow('gwTest', 'repair', { share: 1, ru: 'не соответствует', en: 'fail' }),
      flow('repair', 'gwRepair'),
      flow('gwRepair', 'routine', { share: 91, ru: 'исправим', en: 'repairable' }),
      flow('gwRepair', 'scrap', { share: 9, ru: 'брак', en: 'scrap' }),
      flow('sample', 'paint'),
      flow('paint', 'pack'),
      flow('pack', 'end'),
      { source: 'release', target: 'specData', type: 'dataAssociation' },
      { source: 'routine', target: 'passport', type: 'dataAssociation' },
      { source: 'surge', target: 'note', type: 'association' },
    ],
  },
};
