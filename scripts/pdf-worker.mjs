// No environment credentials, file writes, network fetches or PDF actions.
import {getDocumentProxy} from 'unpdf'
let bytes=Buffer.alloc(0)
for await(const part of process.stdin){bytes=Buffer.concat([bytes,part]);if(bytes.length>15*1024*1024)process.exit(1)}
try{
  const pdf=await getDocumentProxy(new Uint8Array(bytes),{isEvalSupported:false,useSystemFonts:false})
  try{
    if(pdf.numPages<1 || pdf.numPages>100)throw new Error('page limit')
    const pages=[];let length=0
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i),content=await page.getTextContent()
      const text=content.items.map(item=>'str' in item ? item.str:'').join(' ')
      length+=text.length;if(length>500000)throw new Error('text limit')
      pages.push(text);page.cleanup()
    }
    process.stdout.write(JSON.stringify({pages,totalPages:pdf.numPages}))
  }finally{await pdf.destroy()}
}catch{process.exitCode=1}
