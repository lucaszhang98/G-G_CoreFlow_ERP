import { redirect } from "next/navigation"

export default async function Home() {
  // 根路径直接重定向到登录页
  // middleware 会处理已登录用户的重定向
  redirect("/login")
}
