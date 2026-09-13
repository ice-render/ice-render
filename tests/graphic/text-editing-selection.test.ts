/**
 * B 组（文本能力增强）第 6 项 / 第 7 项回归：
 *
 * 6. **多行编辑**：`multiline: true` 时编辑态用透明 `<textarea>` 承接输入、回车插入 `\n`
 *    （不再回车即提交），无 DOM 运行时的 keydown 降级路径同步跟上。
 * 7. **选区**：`selectionStart/selectionEnd` 由引擎自绘（无 DOM 运行时没有浏览器选区），
 *    并提供**按字形**的坐标 → 光标下标换算（`getCaretIndexAt`），编辑态的点命中按文本行判定。
 */
const created: any[] = [];

jest.mock('../../src/cross-platform/root', () => {
  const PolyfillPath2D = jest.requireActual('../../src/cross-platform/PolyfillPath2D').default;
  const makeEl = (tag: string) => {
    const el: any = {
      tagName: String(tag).toUpperCase(),
      style: {},
      value: '',
      selectionStart: 0,
      selectionEnd: 0,
      parentNode: null,
      addEventListener: () => {},
      setAttribute: () => {},
      focus: () => {},
      setSelectionRange: (s: number, e: number) => {
        el.selectionStart = s;
        el.selectionEnd = e;
      },
      appendChild: () => {},
      removeChild: () => {},
    };
    return el;
  };
  return {
    __esModule: true,
    default: {
      createPath2D: () => new PolyfillPath2D(),
      loadFont: jest.fn(() => Promise.resolve('ok')),
      document: {
        getElementById: () => null,
        createElement: (tag: string) => {
          const el = makeEl(tag);
          created.push(el);
          return el;
        },
        body: { appendChild: () => {}, removeChild: () => {} },
      },
    },
  };
});

import ICEText from '../../src/graphic/text/ICEText';

function makeCtx(): any {
  const ctx: any = {
    font: '',
    letterSpacing: '0px',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    measureText: (s: string) => {
      const chars = Array.from(String(s));
      return { width: chars.length * 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 };
    },
    fillText: () => {},
    strokeText: () => {},
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fill() {},
    rect() {},
    fillRect: () => {},
    clip() {},
    translate() {},
    rotate() {},
    scale() {},
    transform() {},
    setTransform() {},
    resetTransform() {},
    setLineDash() {},
  };
  return ctx;
}

/** 造一个带本地坐标的文本（origin 在盒子中心，与引擎一致）。 */
function makeText(props: any = {}): ICEText {
  const text = new ICEText(props);
  (text as any).ctx = makeCtx();
  (text as any).measureText();
  (text.state as any).localOrigin = [Number(text.state.width) / 2, Number(text.state.height) / 2];
  return text;
}

function press(text: ICEText, key: string): void {
  (text as any).keyboardEvtHandler({ type: 'keydown', key });
}

describe('第 6 项：多行编辑', () => {
  it('multiline: true 时无 DOM 路径的回车插入换行，Escape 才提交', () => {
    const text = makeText({ text: 'ab', multiline: true, editing: true, caretIndex: 2 });
    press(text, 'Enter');
    expect(text.getText()).toBe('ab\n');
    expect(text.state.editing).toBe(true);
    press(text, 'Escape');
    expect(text.state.editing).toBe(false);
  });

  it('默认（单行）回车仍然是提交（保持既有行为）', () => {
    const text = makeText({ text: 'ab', editing: true, caretIndex: 2 });
    press(text, 'Enter');
    expect(text.getText()).toBe('ab');
    expect(text.state.editing).toBe(false);
  });

  it('文本里已有 \\n 时编辑自动按多行处理（回车不会把内容提交丢掉）', () => {
    const text = makeText({ text: 'a\nb', editing: true, caretIndex: 3 });
    press(text, 'Enter');
    expect(text.getText()).toBe('a\nb\n');
    expect(text.state.editing).toBe(true);
  });

  it('有 DOM 时多行编辑挂 <textarea>，单行仍挂 <input>', () => {
    const fields = () => created.filter((el) => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
    created.length = 0;
    const multi = makeText({ text: 'a\nb', multiline: true });
    multi.startEditing();
    const multiField = fields()[0];
    expect(fields().map((el) => el.tagName)).toEqual(['TEXTAREA']);
    expect(multiField.value).toBe('a\nb');
    multi.stopEditing();

    created.length = 0;
    const single = makeText({ text: 'ab' });
    single.startEditing();
    expect(fields().map((el) => el.tagName)).toEqual(['INPUT']);
    single.stopEditing();
  });
});

describe('第 7 项：选区与字形命中', () => {
  it('setSelection / getSelection / selectAll 的下标语义（含越界收敛）', () => {
    const text = makeText({ text: 'hello' });
    text.setSelection(1, 3);
    expect(text.getSelection()).toEqual({ start: 1, end: 3 });
    expect(text.state.caretIndex).toBe(3);

    text.setSelection(-5, 99);
    expect(text.getSelection()).toEqual({ start: 0, end: 5 });

    text.selectAll();
    expect(text.getSelection()).toEqual({ start: 0, end: 5 });
  });

  it('选区由引擎自绘：编辑态画一条覆盖 2..4 的底色块（每字符 10px）', () => {
    const text = makeText({ text: 'abcd', editing: true, selectionStart: 2, selectionEnd: 4 });
    const rects: number[][] = [];
    (text as any).ctx.fillRect = (x: number, y: number, w: number, h: number) => rects.push([x, y, w, h]);
    (text as any).renderSelection();

    expect(rects.length).toBe(1);
    const [x, , w, h] = rects[0];
    // 左对齐、无 padding：文字左边缘 = -localOrigin[0]；第 2 个字符起点 = 左边缘 + 20
    expect(x).toBeCloseTo(-Number(text.state.width) / 2 + 20, 5);
    expect(w).toBeCloseTo(20, 5);
    expect(h).toBeCloseTo(Number(text.state.textHeight), 5);
  });

  it('getCaretIndexAt：按字形中点取最近边界（点在第 2 与第 3 个字符之间 → 2）', () => {
    const text = makeText({ text: 'abcd' });
    const left = -Number(text.state.width) / 2;
    expect((text as any).getCaretIndexAt(left + 1, 0)).toBe(0);
    expect((text as any).getCaretIndexAt(left + 24, 0)).toBe(2);
    expect((text as any).getCaretIndexAt(left + 999, 0)).toBe(4);
  });

  it('getCaretIndexAt：多行按 y 先选行，返回的下标含 \\n 偏移', () => {
    const text = makeText({ text: 'ab\ncd', style: { fontSize: 20 } });
    const left = -Number(text.state.width) / 2;
    const boxes = (text as any).__lineBoxes();
    expect((text as any).getCaretIndexAt(left + 5, boxes[0].top + 1)).toBe(0);
    expect((text as any).getCaretIndexAt(left + 5, boxes[1].top + 1)).toBe(3);
  });

  it('编辑态的 containsLocalPoint 按文本行判定：落在行外的盒子空白处不算命中', () => {
    const text = makeText({ text: 'ab', editing: true, style: { fontSize: 20, paddingLeft: 0 } });
    const half = Number(text.state.width) / 2;
    const halfH = Number(text.state.height) / 2;
    expect((text as any).containsLocalPoint(0, 0)).toBe(true);
    expect((text as any).containsLocalPoint(-half + 1, 0)).toBe(true);
    expect((text as any).containsLocalPoint(half + 50, 0)).toBe(false); // 超出文字行横向范围
    expect((text as any).containsLocalPoint(0, halfH + 50)).toBe(false); // 超出盒外
  });

  it('非编辑态仍按整个盒子命中（拖动 / 框选组件的行为不变）', () => {
    const text = makeText({ text: 'ab', width: 100, style: { fontSize: 20 } });
    expect((text as any).containsLocalPoint(40, 0)).toBe(true); // 文字行之外的盒子空白
    text.setState({ editing: true });
    expect((text as any).containsLocalPoint(40, 0)).toBe(false); // 编辑态只命中文字行
  });
});
