/**
 * Util visual para landings: inyecta <style> que oculta el header/footer
 * del storefront layout si la landing config lo pide.
 * Usado por HotmartLanding, FunnelLanding, VslLanding.
 */
export function LandingChrome({ hideNav, hideFooter }: { hideNav?: boolean; hideFooter?: boolean }) {
  if (!hideNav && !hideFooter) return null;
  const rules: string[] = [];
  if (hideNav) rules.push('.storefront-header { display: none !important; }');
  if (hideFooter) rules.push('.storefront-footer { display: none !important; }');
  return <style dangerouslySetInnerHTML={{ __html: rules.join(' ') }} />;
}
