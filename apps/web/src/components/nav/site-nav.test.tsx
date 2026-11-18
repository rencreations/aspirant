import { act, render } from "@testing-library/react";
import { vi } from "vitest";

import { useNavLock } from "@/lib/nav-lock";

const route = vi.hoisted(() => ({ path: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => route.path }));
vi.mock("@/components/smooth-scroll", () => ({
  useLenis: () => ({ pause: () => undefined, resume: () => undefined }),
}));
vi.mock("@/components/logo/aspirant-logo", () => ({ AspirantLogo: () => <svg /> }));
vi.mock("@/components/transition/t-link", () => ({
  TLink: ({
    href,
    children,
    transitionLabel: _label,
    ...rest
  }: {
    href: string;
    children?: React.ReactNode;
    transitionLabel?: string;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/features/legal/consent/use-consent", () => ({
  useConsent: { getState: () => ({ reopen: () => undefined }) },
}));
vi.mock("@/lib/hooks", () => ({ useThemeAt: () => "daybreak" }));
vi.mock("@/lib/audio", () => ({ audio: { blip: () => undefined } }));
vi.mock("./sound-button", () => ({ SoundButton: () => <button type="button">Sound</button> }));
vi.mock("./now-playing", () => ({ NowPlaying: () => null }));
vi.mock("./menu-pairs", () => ({ MENU_PAIRS: {}, warmMenuPairs: () => Promise.resolve() }));

const { SiteNav } = await import("./site-nav");

const SHOWN = { hideLogo: false, hideControls: false } as const;

beforeEach(() => {
  route.path = "/";
  useNavLock.setState(SHOWN);
});

function parts(container: HTMLElement) {
  const header = container.querySelector("header")!;
  const brand = container.querySelector("[data-logo-host]")!;
  const trigger = header.querySelector('button[aria-label="Open menu"]')!;
  return { header, brand, controls: trigger.parentElement! };
}

describe("the bar's two hiding fields", () => {
  it("show everything by default", () => {
    const { header, brand, controls } = parts(render(<SiteNav />).container);
    expect(header).not.toHaveAttribute("data-hide-logo");
    expect(header).not.toHaveAttribute("data-hide-controls");
    expect(brand).not.toHaveAttribute("inert");
    expect(controls).not.toHaveAttribute("inert");
  });

  it("hide the logo on its own: the brand link is inert, the controls stay", () => {
    const { header, brand, controls } = parts(render(<SiteNav />).container);
    act(() => {
      useNavLock.setState({ hideLogo: true });
    });
    expect(header).toHaveAttribute("data-hide-logo", "true");
    expect(header).not.toHaveAttribute("data-hide-controls");
    expect(brand).toHaveAttribute("inert");
    expect(controls).not.toHaveAttribute("inert");
  });

  it("hide the controls on their own: the logo stays", () => {
    const { header, brand, controls } = parts(render(<SiteNav />).container);
    act(() => {
      useNavLock.setState({ hideControls: true });
    });
    expect(header).toHaveAttribute("data-hide-controls", "true");
    expect(header).not.toHaveAttribute("data-hide-logo");
    expect(controls).toHaveAttribute("inert");
    expect(brand).not.toHaveAttribute("inert");
    // The page name on the right goes with the controls.
    expect(header.querySelector("p")).toHaveAttribute("inert");
  });

  it("are cleared when the path becomes another page, without waiting for the home to unmount", () => {
    const view = render(<SiteNav />);
    act(() => {
      useNavLock.setState({ hideLogo: true, hideControls: true });
    });
    expect(useNavLock.getState()).toMatchObject({ hideLogo: true, hideControls: true });
    route.path = "/about/";
    view.rerender(<SiteNav />);
    expect(useNavLock.getState()).toMatchObject({ hideLogo: false, hideControls: false });
    const { header } = parts(view.container);
    expect(header).not.toHaveAttribute("data-hide-logo");
    expect(header).not.toHaveAttribute("data-hide-controls");
  });

  it("are kept on the home page, also when the home is reached by a path change", () => {
    route.path = "/about/";
    const view = render(<SiteNav />);
    act(() => {
      useNavLock.setState({ hideLogo: true, hideControls: true });
    });
    route.path = "/";
    view.rerender(<SiteNav />);
    expect(useNavLock.getState()).toMatchObject({ hideLogo: true, hideControls: true });
  });
});
