// jest-dom.d.ts
declare namespace jest {
  interface Matchers<R> {
    toBeInTheDocument(): R;
    toBeVisible(): R;
    toBeEmpty(): R;
    toBeDisabled(): R;
    toBeEnabled(): R;
    toBeInvalid(): R;
    toBeRequired(): R;
    toBeValid(): R;
    toBeChecked(): R;
    toBePartiallyChecked(): R;
    toHaveAccessibleDescription(expected?: string | RegExp): R;
    toHaveAccessibleName(expected?: string | RegExp): R;
    toHaveAttribute(attr: string, value?: string | number | boolean): R;
    toHaveClass(...classNames: string[]): R;
    toHaveFocus(): R;
    toHaveFormValues(
      expectedValues: Record<string, string | number | boolean>,
    ): R;
    toHaveStyle(css: string | Record<string, string | number>): R;
    toHaveTextContent(
      expected?: string | RegExp,
      options?: { normalizeWhitespace: boolean },
    ): R;
    toHaveValue(expected?: string | string[] | number | null): R;
    toHaveDisplayValue(expected?: string | RegExp | Array<string | RegExp>): R;
    toBeInTheDocument(): R;
    toContainElement(element: HTMLElement | null): R;
    toContainHTML(htmlText: string): R;
    toHaveDescription(expected?: string | RegExp): R;
  }
}

declare module "testing-library__jest-dom";
declare module "@testing-library/jest-dom";
