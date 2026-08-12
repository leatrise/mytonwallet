import { buildToncenterSocketUrl } from './socket';

jest.mock('../../../common/backend', () => ({
  addBackendHeadersToSocketUrl: jest.fn(),
}));

describe('buildToncenterSocketUrl', () => {
  it.each([
    ['http://192.168.1.45:8080/toncenter/mainnet', 'ws:'],
    ['https://api.yohi.io/toncenter/mainnet', 'wss:'],
  ])('maps %s to %s', (baseUrl, protocol) => {
    const url = buildToncenterSocketUrl(baseUrl);

    expect(url.protocol).toBe(protocol);
    expect(url.pathname).toBe('/toncenter/mainnet/api/streaming/v2/ws');
  });
});
