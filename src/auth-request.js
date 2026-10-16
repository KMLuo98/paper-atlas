export async function invokeWithSessionRetry(client, options) {
  let result = await client.functions.invoke('library-api', options);
  if (result.error?.context?.status !== 401) return result;
  const {data} = await client.auth.getSession();
  if (!data.session) return result;
  const refreshed = await client.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session) throw new Error('登录已失效，请退出后重新登录');
  // Only replay an authentication rejection; never repeat paid AI work on timeouts.
  return client.functions.invoke('library-api', options);
}
