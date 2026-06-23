declare global {
  interface Window {
    fxBrowser: {
      parseMoreLoginText: (text: string) => Promise<unknown>;
    };
  }
}

export {};
