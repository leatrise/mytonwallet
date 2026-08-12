import type { ActivityStream, OnActivityUpdate, OnLoadingChange } from './toncenter';

import { RichActivityStream } from './richActivityStream';

describe('RichActivityStream', () => {
  it('clears the loading state when destroyed during raw activity loading', () => {
    let onLoadingChange: OnLoadingChange | undefined;
    const rawActivityStream = {
      onUpdate: jest.fn((_callback: OnActivityUpdate) => jest.fn()),
      onLoadingChange: jest.fn((callback: OnLoadingChange) => {
        onLoadingChange = callback;
        return jest.fn();
      }),
    } as unknown as ActivityStream;
    const loadingEvents: boolean[] = [];
    const stream = new RichActivityStream('0-ton-mainnet', rawActivityStream);

    stream.onLoadingChange((isLoading) => loadingEvents.push(isLoading));
    onLoadingChange!(true);

    expect(loadingEvents).toEqual([true]);

    stream.destroy();

    expect(loadingEvents).toEqual([true, false]);
  });
});
