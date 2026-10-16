export async function removeUserFiles(service, userId) {
  // Only these app-owned private folders are eligible for deletion.
  for (const bucket of ['papers', 'avatars']) {
    for (;;) {
      const {data, error} = await service.storage.from(bucket).list(userId, {limit: 100, offset: 0});
      if (error) throw new Error('无法读取账户文件，请稍后重试注销');
      if (!data?.length) break;
      if (data.some(file => !file.id || file.name.includes('/') || file.name === '..')) throw new Error('账户文件路径异常，请联系维护者');
      const {error: removeError} = await service.storage.from(bucket).remove(data.map(file => `${userId}/${file.name}`));
      if (removeError) throw new Error('部分文件未能删除，账户暂未注销，请稍后重试');
    }
  }
}
