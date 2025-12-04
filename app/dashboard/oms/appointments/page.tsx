import { DashboardLayout } from '@/components/dashboard-layout';
import { auth } from "@/auth";
import { redirect } from 'next/navigation';
import { DeliveryAppointmentTable } from './delivery-appointment-table';

export default async function DeliveryAppointmentsPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <DeliveryAppointmentTable />
    </DashboardLayout>
  );
}


