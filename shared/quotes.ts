export interface Quote {
  text: string;
  author: string;
}

export const QUOTES: Quote[] = [
  { text: '山重水复疑无路，柳暗花明又一村。', author: '陆游' },
  { text: '不积跬步，无以至千里；不积小流，无以成江海。', author: '荀子' },
  { text: '长风破浪会有时，直挂云帆济沧海。', author: '李白' },
  { text: '纸上得来终觉浅，绝知此事要躬行。', author: '陆游' },
  { text: '海内存知己，天涯若比邻。', author: '王勃' },
  { text: '会当凌绝顶，一览众山小。', author: '杜甫' },
  { text: '沉舟侧畔千帆过，病树前头万木春。', author: '刘禹锡' },
  { text: '问渠那得清如许？为有源头活水来。', author: '朱熹' },
  { text: '路漫漫其修远兮，吾将上下而求索。', author: '屈原' },
  { text: '莫愁前路无知己，天下谁人不识君。', author: '高适' },
];

export function getDailyQuoteIndex(date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  return ((day % QUOTES.length) + QUOTES.length) % QUOTES.length;
}
