// ============================================================================
//  НАСТРОЙКИ МАГАЗИНА
//  Всё, что нужно поменять под свой бренд, находится в этом файле:
//  название, контакты, цены, доступные варианты изделий.
// ============================================================================

export const BRAND = {
  name: 'AISUL',                   // название бренда (в шапке и в заявке)
  tagline: 'Украшения с бриллиантами на заказ',
  currency: '₸',
  locale: 'ru-KZ',
  // Номера WhatsApp в международном формате без "+".
  // Если добавить по номеру на каждый город, в заявке появится выбор города.
  cities: [
    { id: 'main', label: 'Казахстан', whatsapp: '77006899152' },
  ],
  instagram: '',                   // например 'https://www.instagram.com/yourbrand/'
};

// Формы бриллианта в порядке показа. id используется в геометрии (js/shapes.js).
export const SHAPES = [
  { id: 'round',    label: 'Круглый' },
  { id: 'princess', label: 'Принцесса' },
  { id: 'radiant',  label: 'Радиант' },
  { id: 'cushion',  label: 'Кушон' },
  { id: 'oval',     label: 'Овал' },
  { id: 'pear',     label: 'Груша' },
  { id: 'heart',    label: 'Сердце' },
  { id: 'marquise', label: 'Маркиз' },
  { id: 'emerald',  label: 'Изумруд' },
  { id: 'asscher',  label: 'Ашер' },
];

// Модели колец (шинка). price — базовая цена с центральным камнем 1 ct.
export const SHANKS = [
  { id: 'trio',      label: 'Trio',      note: 'Три камня: груши по бокам',  price: 800000 },
  { id: 'trio-pave', label: 'Trio Pavé', note: 'Трилогия и дорожка камней',  price: 900000 },
  { id: 'solo',      label: 'Solo',      note: 'Классический солитер',       price: 550000 },
  { id: 'solo-pave', label: 'Solo Pavé', note: 'Солитер и дорожка камней',   price: 650000 },
  { id: 'bezel',     label: 'Bezel',     note: 'Камень в ободке',            price: 550000 },
];

// Касты (крепление центрального камня). price — доплата к модели.
export const SETTINGS = [
  { id: 'prong', label: 'Крапаны', note: 'Лапки держат камень',  price: 0 },
  { id: 'halo',  label: 'Ореол',   note: 'Ободок из мелких камней', price: 150000 },
  { id: 'bezel', label: 'Безель',  note: 'Сплошной ободок',     price: 100000 },
];

// Все модели колец каталога (шинка + каста) — по 9 на каждую форму камня.
export const RING_MODELS = [
  { shank: 'trio', setting: 'prong' },
  { shank: 'trio', setting: 'halo' },
  { shank: 'trio-pave', setting: 'prong' },
  { shank: 'trio-pave', setting: 'halo' },
  { shank: 'solo', setting: 'prong' },
  { shank: 'solo', setting: 'halo' },
  { shank: 'solo-pave', setting: 'prong' },
  { shank: 'solo-pave', setting: 'halo' },
  { shank: 'bezel', setting: 'bezel' },
];

export const METALS = [
  { id: 'white',  label: 'Белое золото',   color: '#d9dde3' },
  { id: 'yellow', label: 'Жёлтое золото',  color: '#e3b45b' },
  { id: 'rose',   label: 'Розовое золото', color: '#e3a48b' },
];

export const PURITIES = [
  { id: '585', label: '585 · 14K', price: 0 },
  { id: '750', label: '750 · 18K', price: 100000 },
];

export const STONE_COLORS = [
  { id: 'white',  label: 'Белый',      color: '#ffffff', fancy: false },
  { id: 'green',  label: 'Зелёный',    color: '#45d68a', fancy: true },
  { id: 'yellow', label: 'Жёлтый',     color: '#ffd84a', fancy: true },
  { id: 'pink',   label: 'Розовый',    color: '#ff9fc4', fancy: true },
  { id: 'blue',   label: 'Синий',      color: '#4f8dff', fancy: true },
  { id: 'ruby',   label: 'Рубин',      color: '#c8103e', fancy: true },
  { id: 'red',    label: 'Красный',    color: '#ff3b3b', fancy: true },
  { id: 'purple', label: 'Фиолетовый', color: '#9b5cf0', fancy: true },
  { id: 'black',  label: 'Чёрный',     color: '#2a2a2e', fancy: true },
  { id: 'orange', label: 'Оранжевый',  color: '#ff8a2a', fancy: true },
];

export const CARATS = [1, 1.5, 2, 3, 4, 5];            // кольца
export const STUD_CARATS = [0.5, 1, 1.5, 2, 3];        // пусеты, каждый камень
export const RING_SIZES = [15, 15.5, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5, 20, 21];

// Пусеты (серьги-гвоздики). price: null — «Цена по запросу».
export const STUD_SETTINGS = [
  { id: 'prong', label: 'Classic', price: null },
  { id: 'halo',  label: 'Halo',    price: null },
];
// Формы, доступные для каждого вида пусет
export const STUD_SHAPES = {
  prong: ['round', 'princess', 'radiant', 'cushion', 'oval', 'pear', 'heart', 'marquise', 'emerald', 'asscher'],
  halo: ['round', 'oval', 'pear', 'marquise', 'emerald', 'radiant'],
};

export const PRICING = {
  caratPrice: 200000,          // за каждый карат сверх 1 ct
  fancyColorPerCarat: 100000,  // цветной центральный камень, за 1 ct
  fancySide: 100000,           // цветные боковые камни (с ореолом — вдвое)
};

export const DEFAULTS = {
  shape: 'round', shank: 'solo', setting: 'prong', carat: 1,
  metal: 'white', head: 'same', purity: '585', gem1: 'white', gem2: 'white', size: 17,
};
