/**
 * Registers /sw.js after the page has loaded (production only). Inline and
 * tiny on purpose: public menus must not grow their JS bundle for this.
 */
export function RegisterServiceWorker() {
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_SW_DEV !== "1") return null;
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `if("serviceWorker"in navigator)addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){})})`,
      }}
    />
  );
}
