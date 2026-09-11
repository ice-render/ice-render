/**
 * ICEText 文本排版能力：自动换行 / 最大行数省略 / grapheme 切分 / 量测安全。
 *
 * 契约：
 * - wrap 默认关闭 → 完全保持既有「按 \n 拆行」行为（lines = null）
 * - wrap 开启且给定宽度 → 按 grapheme 贪心换行，超过 maxLines 时末行加省略号
 * - 编辑态不换行（caretIndex 按原始文本计，换行会错位）
 * - 量测走 textContent 而非 innerHTML（旧实现是 HTML 注入面）
 */
import ICEText from '../../src/graphic/text/ICEText';

/** 等宽桩：每个 UTF-16 单元宽 10px，单行字形高 10px。 */
function stubCtx() {
  return {
    font: '',
    measureText: (s: string) => ({
      width: s.length * 10,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
    }),
  } as any;
}

function makeText(props: any) {
  const t: any = new ICEText(props);
  t.ctx = stubCtx();
  return t;
}

describe('ICEText 自动换行', () => {
  it('默认不换行：保持既有行为（lines 为 null，宽度=整行宽）', () => {
    const t = makeText({ text: 'abcdefgh' });
    const r = (t as any).measureText();
    expect(t.state.lines).toBeNull();
    expect(r.width).toBe(80);
    expect(r.height).toBe(10);
  });

  it('wrap 开启：按给定宽度贪心断行', () => {
    const t = makeText({ text: 'abcdefgh', wrap: true, width: 50 });
    const r = (t as any).measureText();

    expect(t.state.lines).toEqual(['abcde', 'fgh']);
    expect(t.state.width).toBe(50); // 用户给的宽度不被覆盖
    expect(r.height).toBe(20); // 2 行 × 10
  });

  it('wrap 关闭时即使给了窄宽度也不换行', () => {
    const t = makeText({ text: 'abcdefgh', width: 50 });
    (t as any).measureText();
    expect(t.state.lines).toBeNull();
  });

  it('段落换行 \\n 与自动换行叠加', () => {
    const t = makeText({ text: 'abc\ndefghijk', wrap: true, width: 50 });
    (t as any).measureText();
    expect(t.state.lines).toEqual(['abc', 'defgh', 'ijk']);
  });

  it('宽度非法（0/负数）时不换行', () => {
    const t = makeText({ text: 'abcdefgh', wrap: true, width: 0 });
    (t as any).measureText();
    expect(t.state.lines).toBeNull();
  });

  it('编辑态不换行（避免 caretIndex 与显示行错位）', () => {
    const t = makeText({ text: 'abcdefgh', wrap: true, width: 50 });
    t.setState({ editing: true });
    (t as any).measureText();
    expect(t.state.lines).toBeNull();
  });
});

describe('ICEText 最大行数与省略号', () => {
  it('超过 maxLines 时截断末行并加省略号，且宽度不超限', () => {
    const t = makeText({ text: 'abcdefgh', wrap: true, width: 50, maxLines: 1 });
    (t as any).measureText();

    expect(t.state.lines!.length).toBe(1);
    expect(t.state.lines![0].endsWith('…')).toBe(true);
    // 内容 + 省略号必须放得下（5 个单元 = 50px）
    expect(t.state.lines![0].length).toBe(5);
    expect(t.state.lines![0]).toBe('abcd…');
  });

  it('自定义省略号同样遵守宽度约束', () => {
    const t = makeText({ text: 'abcdefgh', wrap: true, width: 50, maxLines: 1, ellipsis: '>>' });
    (t as any).measureText();
    expect(t.state.lines![0]).toBe('abc>>');
  });

  it('行数未超 maxLines 时不加省略号', () => {
    const t = makeText({ text: 'abcdefgh', wrap: true, width: 50, maxLines: 3 });
    (t as any).measureText();
    expect(t.state.lines).toEqual(['abcde', 'fgh']);
  });

  it('maxLines=0 表示不限', () => {
    const t = makeText({ text: 'abcdefgh', wrap: true, width: 30, maxLines: 0 });
    (t as any).measureText();
    expect(t.state.lines).toEqual(['abc', 'def', 'gh']);
  });
});

describe('ICEText grapheme 切分', () => {
  it('不把代理对 / ZWJ 序列拆成孤立片段', () => {
    const t = makeText({ text: '👩‍👩‍👧ab', wrap: true, width: 30 });
    (t as any).measureText();

    const lines: string[] = t.state.lines || [];
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(/[\uD800-\uDBFF]$/.test(line)).toBe(false); // 不以高位代理结尾
      expect(/^[\uDC00-\uDFFF]/.test(line)).toBe(false); // 不以低位代理开头
    }
    // 拼回去内容不丢
    expect(lines.join('')).toBe('👩‍👩‍👧ab');
  });

  it('Intl.Segmenter 不可用时退化为码点切分，仍不拆代理对', () => {
    const t = makeText({ text: '👍a', wrap: true, width: 30 });
    const savedIntl = (t.root && t.root.Intl) || null;
    t.root = Object.assign({}, t.root, { Intl: undefined });
    (t as any).measureText();
    const lines: string[] = t.state.lines || [];
    for (const line of lines) {
      expect(/^[\uDC00-\uDFFF]/.test(line)).toBe(false);
    }
    t.root.Intl = savedIntl;
  });
});

describe('ICEText 量测安全（HTML 注入）', () => {
  it('DOM 降级量测使用 textContent，绝不写 innerHTML', () => {
    const injected = '<img src=x onerror="window.__pwned=1">';
    const t: any = new ICEText({ text: injected, style: { fontSize: 20 } });

    const div: any = {
      style: {},
      setAttribute: () => {},
      contenteditable: false,
      textContent: '',
      innerHTML: 'UNTOUCHED',
      offsetWidth: 40,
      offsetHeight: 20,
    };
    // 让 getElementById 返回 null，走「创建」分支：样式（含 white-space:pre）在这一步应用。
    // 复用分支不会重设样式，因此这里必须走创建路径才能验证换行机制。
    t.root = {
      document: {
        getElementById: () => null,
        createElement: () => div,
        body: { appendChild: () => {} },
      },
    };

    (t as any).__measureByDOM();

    expect(div.textContent).toBe(injected);
    expect(div.innerHTML).toBe('UNTOUCHED'); // 未被当作 HTML 写入
    expect(div.style.whiteSpace).toBe('pre'); // 换行改由 CSS 负责
  });
});
