import assert from 'node:assert/strict';
import test from 'node:test';

import SeascapeControlProvider, {
  buildSeascapeControlInput,
  runSeascapeControlFromVars,
} from './seascape-control-provider.mjs';

test('buildSeascapeControlInput maps bakeoff vars into the Seascape control shape', () => {
  const input = buildSeascapeControlInput({
    conversationId: 38137256,
    listingId: 206016,
    propertyName: 'Dockside Dreams',
    guestName: 'Ibrahem Aabed',
    channel: 'airbnb',
    historyText: '[Host - Sawyer]: Previous reply\n[Guest - Ibrahem Aabed]: Hi, the stove is not heating',
  });

  assert.equal(input.convId, '38137256');
  assert.equal(input.listingId, '206016');
  assert.equal(input.propertyName, 'Dockside Dreams');
  assert.equal(input.guestName, 'Ibrahem Aabed');
  assert.equal(input.channel, 'airbnb');
  assert.match(input.history, /stove is not heating/);
});

test('runSeascapeControlFromVars delegates to the injected Seascape runner', async () => {
  const result = await runSeascapeControlFromVars(
    {
      conversationId: 38137256,
      listingId: 206016,
      propertyName: 'Dockside Dreams',
      guestName: 'Ibrahem Aabed',
      channel: 'airbnb',
      historyText: '[Guest - Ibrahem Aabed]: Hi, the stove is not heating',
    },
    {
      adapterRunner: (input) => ({
        tier: 'approve',
        category: 'routine',
        draft: `Hi ${input.guestName}! I’m checking on that now.`,
        notes: 'control',
      }),
    },
  );

  assert.equal(result.output, 'Hi Ibrahem Aabed! I’m checking on that now.');
  assert.equal(result.raw.category, 'routine');
});

test('SeascapeControlProvider returns promptfoo output from the control runner', async () => {
  const provider = new SeascapeControlProvider({
    adapterRunner: () => ({
      tier: 'approve',
      category: 'routine',
      draft: 'Hi Ibrahem! I’m checking on that now.',
      notes: 'control',
    }),
  });

  const result = await provider.callApi('', {
    vars: {
      conversationId: 38137256,
      listingId: 206016,
      propertyName: 'Dockside Dreams',
      guestName: 'Ibrahem Aabed',
      channel: 'airbnb',
      historyText: '[Guest - Ibrahem Aabed]: Hi, the stove is not heating',
    },
  });

  assert.equal(result.output, 'Hi Ibrahem! I’m checking on that now.');
});
