import { expect, it } from 'vitest';
import { fragmentPayload } from '../../src/ui/fragmentFields.js';

it('空章节/场次转 null，正文保持原样', () => {
  expect(fragmentPayload({ chapter: '', scene: '2', text: '他把[[还脉礼]]交还。' }))
    .toEqual({ chapter: null, scene: 2, text: '他把[[还脉礼]]交还。' });
  expect(fragmentPayload({ chapter: 'abc', scene: '', text: '' }))
    .toEqual({ chapter: null, scene: null, text: '' });
});
