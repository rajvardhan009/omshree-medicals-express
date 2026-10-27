import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = process.env.TEST_API_URL || 'http://localhost:4000/api';
async function call(path, method='GET', body, token) {
  const res = await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return { status:res.status, data:res.status===204?null:await res.json() };
}
async function account() {
 const email=`test-${randomUUID()}@example.test`,password=randomUUID();
 const {data,status}=await call('/auth/signup','POST',{email,password});assert.equal(status,201);
 const login=await call('/auth/login','POST',{email,password});assert.equal(login.status,200);
 return login.data;
}
test('profile update is persisted and does not change login email',async()=>{
 const user=await account();
 const updated=await call('/auth/me','PUT',{full_name:'Local profile',email:'ignored@example.test'},user.token);
 assert.equal(updated.status,200);
 const read=await call('/auth/me','GET',undefined,user.token);
 assert.equal(read.data.full_name,'Local profile');assert.equal(read.data.email,user.user.email);
});
test('replaying a client UUID creates one bill with the same number',async()=>{
 const user=await account(),id=randomUUID(),body={id,patient_name:'Replay check',manual_amount:250};
 const a=await call('/bills','POST',body,user.token),b=await call('/bills','POST',body,user.token);
 assert.equal(a.status,201);assert.equal(b.status,201);assert.equal(a.data.id,b.data.id);assert.equal(a.data.sequential_number,b.data.sequential_number);
 const list=await call('/bills','GET',undefined,user.token);assert.equal(list.data.filter(x=>x.id===id).length,1);assert.equal(Number(a.data.amount),250);
});
test('a second account cannot read or update another account profile or bills',async()=>{
 const a=await account(),b=await account();
 const created=await call('/bills','POST',{patient_name:'Private bill',manual_amount:100},a.token);
 assert.equal((await call(`/bills/${created.data.id}`,'GET',undefined,b.token)).status,404);
 assert.equal((await call(`/bills/${created.data.id}`,'PUT',{patient_name:'Changed'},b.token)).status,404);
 assert.equal((await call('/auth/me','PUT',{id:a.user.id,full_name:'Own profile'},b.token)).data.id,b.user.id);
});
test('indoor patient deletion remains a soft delete',async()=>{
 const u=await account();const created=await call('/indoor-patients','POST',{patient_name:'Soft delete check'},u.token);
 assert.equal(created.status,201);assert.equal((await call(`/indoor-patients/${created.data.id}`,'DELETE',undefined,u.token)).status,204);
 const list=await call('/indoor-patients','GET',undefined,u.token);assert.equal(list.data.some(x=>x.id===created.data.id),false);
 assert.equal((await call(`/indoor-patients/${created.data.id}`,'GET',undefined,u.token)).status,404);
});
