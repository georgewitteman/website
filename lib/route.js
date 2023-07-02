/**
 * @param  {(string | number)[]} paths
 */
export function route(...paths) {
  return `/${paths.map(encodeURIComponent).join("/")}`;
}
