const pendingErrors = new WeakSet();

/* Mensagem local: mantém o rascunho, associa o erro ao campo e limpa ao escrever. */
function fieldError(id, message) {
  const field=document.getElementById(id);
  if(!field) return;
  let error=document.getElementById(`${id}-error`);
  if(!error){
    error=document.createElement('div'); error.id=`${id}-error`;
    error.className='inline-error'; error.setAttribute('role','alert');
    field.insertAdjacentElement('afterend',error);
  }
  error.textContent=message;
  if(pendingErrors.has(field)){ field.focus(); return; }
  pendingErrors.add(field);
  const previous=field.getAttribute('aria-describedby');
  const ids=new Set((previous || '').split(/\s+/).filter(Boolean)); ids.add(error.id);
  field.setAttribute('aria-describedby',[...ids].join(' '));
  field.setAttribute('aria-invalid','true'); error.textContent=message;
  field.addEventListener('input',()=>{
    pendingErrors.delete(field);
    error.textContent=''; field.removeAttribute('aria-invalid');
    if(previous===null) field.removeAttribute('aria-describedby'); else field.setAttribute('aria-describedby',previous);
  },{once:true});
  field.focus();
}
export { fieldError };
