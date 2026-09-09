import { Grid } from 'antd';

const { useBreakpoint } = Grid;

export interface ResponsiveInfo {
  /** True on phones, i.e. below the antd `md` breakpoint (768px). */
  isMobile: boolean;
  /** True on phones and portrait tablets, i.e. below `lg` (992px). */
  isCompact: boolean;
  /** True from `lg` (992px) up, where the fixed sidebar fits. */
  isDesktop: boolean;
}

/**
 * Viewport helper shared by the admin screens. Antd's breakpoints are the
 * single source of truth so CSS media queries and component props agree.
 */
export const useResponsive = (): ResponsiveInfo => {
  const screens = useBreakpoint();
  const isDesktop = Boolean(screens.lg);
  return {
    isMobile: !screens.md,
    isCompact: !screens.lg,
    isDesktop,
  };
};

/**
 * Width for a Modal or Drawer: full bleed on small screens, the requested
 * width on desktop.
 */
export const responsiveModalWidth = (
  desktopWidth: number,
  isCompact: boolean,
): number | string => (isCompact ? '96vw' : desktopWidth);

/** Column count for a Descriptions block, stacking to one column on phones. */
export const descriptionsColumn = {
  xs: 1,
  sm: 1,
  md: 2,
  lg: 2,
  xl: 2,
  xxl: 2,
};

/** Default horizontal scroll config for data tables. */
export const tableScroll = { x: 'max-content' as const };
