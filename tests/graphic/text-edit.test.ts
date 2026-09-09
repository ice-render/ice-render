import ICEText from '../../src/graphic/text/ICEText';

jest.mock('../../src/cross-platform/root', () => ({ __esModule: true, default: {} }));

function key(text: ICEText, k: string) {
  (text as any).keyboardEvtHandler({ key: k, type: 'keydown' });
}

describe('ICEText 内联编辑', () => {
  it('startEditing 进入编辑态并把光标定位到末尾', () => {
    const text = new ICEText({ text: 'ab' });
    expect(text.state.editing).toBe(false);
    text.startEditing();
    expect(text.state.editing).toBe(true);
    expect(text.state.caretIndex).toBe(2);
  });

  it('字符插入 + 光标后移', () => {
    const text = new ICEText({ text: 'ab' });
    text.startEditing();
    key(text, 'c');
    expect(text.getText()).toBe('abc');
    expect(text.state.caretIndex).toBe(3);
  });

  it('Backspace 删除光标前字符', () => {
    const text = new ICEText({ text: 'abc' });
    text.startEditing();
    key(text, 'Backspace');
    expect(text.getText()).toBe('ab');
    expect(text.state.caretIndex).toBe(2);
  });

  it('ArrowLeft/ArrowRight 移动光标，不修改文本', () => {
    const text = new ICEText({ text: 'ab' });
    text.startEditing();
    key(text, 'ArrowLeft');
    expect(text.state.caretIndex).toBe(1);
    key(text, 'ArrowRight');
    expect(text.state.caretIndex).toBe(2);
    expect(text.getText()).toBe('ab');
  });

  it('移动光标后在中间插入字符', () => {
    const text = new ICEText({ text: 'ac' });
    text.startEditing();
    key(text, 'ArrowLeft'); // caret -> 1
    key(text, 'b'); // 在位置 1 插入 b
    expect(text.getText()).toBe('abc');
    expect(text.state.caretIndex).toBe(2);
  });

  it('Home/End 跳到行首/行尾', () => {
    const text = new ICEText({ text: 'abc' });
    text.startEditing();
    key(text, 'Home');
    expect(text.state.caretIndex).toBe(0);
    key(text, 'End');
    expect(text.state.caretIndex).toBe(3);
  });

  it('Enter 提交并退出编辑态', () => {
    const text = new ICEText({ text: 'ab' });
    text.startEditing();
    key(text, 'Enter');
    expect(text.state.editing).toBe(false);
    expect(text.getText()).toBe('ab');
  });

  it('非编辑态时不接管键盘（修饰键/方向键不插入文本）', () => {
    const text = new ICEText({ text: 'ab' });
    // 未编辑态：Shift 等修饰键不应插入
    key(text, 'Shift');
    expect(text.getText()).toBe('ab');
  });
});
