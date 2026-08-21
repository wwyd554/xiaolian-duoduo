// APIモック
export const get = jest.fn().mockResolvedValue({
  body: {
    json: () => Promise.resolve({ settings: { language: "en" } }),
  },
});

export const post = jest.fn().mockResolvedValue({
  body: {
    json: () => Promise.resolve({ success: true }),
  },
});

export default {
  get,
  post,
};
