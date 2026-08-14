import { handleToolCall } from './tools';

describe('handleToolCall', () => {
  describe('get_order_status', () => {
    it('returns order data for a known order ID', () => {
      const result = JSON.parse(handleToolCall('get_order_status', { order_id: 'ORD-1001' }));
      expect(result.status).toBe('Shipped');
      expect(result.items).toContain('Clean Code');
    });

    it('is case-insensitive for order IDs', () => {
      const result = JSON.parse(handleToolCall('get_order_status', { order_id: 'ord-1001' }));
      expect(result.status).toBe('Shipped');
    });

    it('returns an error for an unknown order ID', () => {
      const result = JSON.parse(handleToolCall('get_order_status', { order_id: 'ORD-9999' }));
      expect(result.error).toBeDefined();
    });
  });

  describe('initiate_return', () => {
    it('returns a deterministic RMA number for a valid order', () => {
      const result = JSON.parse(
        handleToolCall('initiate_return', {
          order_id: 'ORD-1001',
          item_name: 'Clean Code',
          reason: 'Wrong edition',
        }),
      );
      expect(result.rma_number).toMatch(/^RMA-\d{5}$/);
      expect(result.ship_to).toBeDefined();
    });

    it('returns same RMA for same inputs (deterministic)', () => {
      const input = { order_id: 'ORD-1001', item_name: 'Clean Code', reason: 'Damaged' };
      const r1 = JSON.parse(handleToolCall('initiate_return', input));
      const r2 = JSON.parse(handleToolCall('initiate_return', input));
      expect(r1.rma_number).toBe(r2.rma_number);
    });

    it('returns an error for an unknown order', () => {
      const result = JSON.parse(
        handleToolCall('initiate_return', {
          order_id: 'ORD-9999',
          item_name: 'Some Book',
          reason: 'Defective',
        }),
      );
      expect(result.error).toBeDefined();
    });
  });

  describe('search_policy', () => {
    it('returns shipping policy text', () => {
      const result = handleToolCall('search_policy', { topic: 'shipping' });
      expect(result).toContain('Standard shipping');
    });

    it('returns returns policy text', () => {
      const result = handleToolCall('search_policy', { topic: 'returns' });
      expect(result).toContain('30 days');
    });

    it('returns error for unknown topic', () => {
      const result = JSON.parse(handleToolCall('search_policy', { topic: 'unknown_topic' }));
      expect(result.error).toBeDefined();
    });
  });

  it('returns error for unknown tool name', () => {
    const result = JSON.parse(handleToolCall('nonexistent_tool', {}));
    expect(result.error).toBeDefined();
  });
});
