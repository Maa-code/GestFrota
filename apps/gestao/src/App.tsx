import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Veiculos } from './pages/Veiculos';
import { Motoristas } from './pages/Motoristas';
import { Contratos } from './pages/Contratos';
import { Cotas } from './pages/Cotas';
import { Auditoria } from './pages/Auditoria';
import { Loader2 } from 'lucide-react';

function PainelPrincipal() {
  const { usuario, carregando } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState('dashboard');

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          <p className="text-sm font-medium">Carregando GestFrota...</p>
        </div>
      </div>
    );
  }

  if (!usuario) {
    return <Login />;
  }

  return (
    <Layout abaAtiva={abaAtiva} onSelecionarAba={setAbaAtiva}>
      {abaAtiva === 'dashboard' && <Dashboard />}
      {abaAtiva === 'veiculos' && <Veiculos />}
      {abaAtiva === 'motoristas' && <Motoristas />}
      {abaAtiva === 'contratos' && <Contratos />}
      {abaAtiva === 'cotas' && <Cotas />}
      {abaAtiva === 'auditoria' && <Auditoria />}
    </Layout>
  );
}

export function App() {
  return (
    <AuthProvider>
      <PainelPrincipal />
    </AuthProvider>
  );
}
