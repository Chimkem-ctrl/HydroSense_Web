export interface DemoResult {
  message: string;
}

const demoResult = (): Promise<DemoResult> =>
  new Promise((resolve) => {
    window.setTimeout(
      () =>
        resolve({
          message:
            'Demo mode: authentication is not connected to a server yet. No account data was sent.',
        }),
      650,
    );
  });

export const authService = {
  signIn: demoResult,
  signUp: demoResult,
  requestPasswordReset: demoResult,
};
