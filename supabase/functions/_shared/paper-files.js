export function paperStoragePaths(paper,owner){
 const paths=[paper.file_path,...(Array.isArray(paper.supplementary_files)?paper.supplementary_files.map(f=>f?.path):[])];
 if(paths.some(path=>typeof path!=='string'||!path.startsWith(owner+'/')||path.includes('..')||path.slice(owner.length+1).includes('/')))throw Error('文件路径无效');
 return [...new Set(paths)];
}
