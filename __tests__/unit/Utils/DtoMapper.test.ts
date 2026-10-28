import { MergeMaskedProjectConfig } from '@Utils/DtoMapper';

describe('MergeMaskedProjectConfig', () => {
  it('drops prototype-related keys instead of writing them', () => {
    const incoming = JSON.parse(
      '{"Variables":{"__proto__":"********","constructor":"x","prototype":"y","API_KEY":"********"}}'
    );
    const stored = { Variables: { API_KEY: 'secret-value' } };

    const merged = MergeMaskedProjectConfig(incoming, stored) as {
      Variables: Record<string, unknown>;
    };

    expect(Object.keys(merged.Variables)).toEqual(['API_KEY']);
    expect(merged.Variables.API_KEY).toBe('secret-value');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(merged.Variables)).toBe(Object.prototype);
  });

  it('only restores a masked value the stored config owns', () => {
    const incoming = { Variables: { toString: '********' } };
    const merged = MergeMaskedProjectConfig(incoming, { Variables: {} }) as {
      Variables: Record<string, unknown>;
    };
    expect(Object.prototype.hasOwnProperty.call(merged.Variables, 'toString')).toBe(false);
  });
});
