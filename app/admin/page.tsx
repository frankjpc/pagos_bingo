import React from 'react';
import AdminBingoCheck from '@/components/AdminBingoCheck';
import { fetchAdminSnapshot } from '@/app/actions/admin-sync';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { moderadores, ventas, configured } = await fetchAdminSnapshot();
  const precioUnitario = Number(process.env.BINGO_PRECIO_UNITARIO) || 50;
  const tasaUsdInicial = Number(process.env.NEXT_PUBLIC_TASA_USD) || 50;

  return (
    <AdminBingoCheck
      initialModeradores={moderadores}
      initialVentas={ventas}
      precioUnitario={precioUnitario}
      moneda="Bs."
      tasaUsdInicial={tasaUsdInicial}
      isSupabaseConfigured={configured}
    />
  );
}
