/** Tiny DOM builders shared by the panel UIs. */

export function div(className: string): HTMLDivElement {
  const el = document.createElement('div');
  if (className) el.className = className;
  return el;
}

export function button(text: string, className: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.textContent = text;
  el.className = className;
  el.type = 'button';
  return el;
}

export function select(options: string[], value: string): HTMLSelectElement {
  const el = document.createElement('select');
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    el.append(o);
  }
  el.value = value;
  return el;
}

export function formRow(label: string, control: HTMLElement): HTMLElement {
  const row = div('form-row');
  const l = document.createElement('label');
  l.textContent = label;
  row.append(l, control);
  return row;
}

export function numberInput(value: number, onInput: (v: number) => void): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'number';
  el.step = 'any';
  el.value = String(value);
  el.addEventListener('input', () => onInput(parseFloat(el.value)));
  return el;
}

export function textInput(value: string, placeholder: string, onInput: (v: string) => void): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'text';
  el.value = value;
  el.placeholder = placeholder;
  el.addEventListener('input', () => onInput(el.value));
  return el;
}

export function colorInput(value: string, onInput: (v: string) => void): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'color';
  el.value = value;
  el.addEventListener('input', () => onInput(el.value));
  return el;
}
