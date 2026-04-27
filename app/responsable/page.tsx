import { redirect } from "next/navigation";

export default function ResponsableHomeRedirect() {
  redirect("/responsable/dashboard");
}