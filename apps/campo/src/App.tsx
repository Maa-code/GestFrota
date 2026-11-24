import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { MobileLayout } from './components/MobileLayout';
import { SolicitarAbastecimento } from './pages/motorista/SolicitarAbastecimento';
import { ConfirmacaoBilateral } from './pages/motorista/ConfirmacaoBilateral';
import { CredencialFuncional } from './pages/motorista/CredencialFuncional';
import { ValidarCodigoAbt } from './pages/frentista/ValidarCodigoAbt';
import { RegistrarAbastecimento } from './pages/frentista/RegistrarAbastecimento';

function AppContent() {
  const { usuario, carregando } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState<string>('');
  const [autorizacaoFrentista, setAutorizacaoFrentista] = useState<any | null>(null);

  // Inicializa aba padrão conforme papel
  useEffect(() => {
    if (usuario) {
      if (usuario.perfilAtivo.papel === 'FRENTISTA') {
        setAbaAtiva('validar');
      } else {
        setAbaAtiva('solicitar');
      }
    }
  }, [usuario?.perfilAtivo.papel]);

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 gap-3">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400 font-mono">Carregando GestFrota Campo...</p>
      </div>
    );
  }

  if (!usuario) {
    return <Login />;
  }

  const isFrentista = usuario.perfilAtivo.papel === 'FRENTISTA';

  return (
    <MobileLayout abaAtiva={abaAtiva} onTrocarAba={setAbaAtiva}>
      {/* Telas do Motorista */}
      {!isFrentista && (
        <>
          {abaAtiva === 'solicitar' && <SolicitarAbastecimento />}
          {abaAtiva === 'confirmar' && <ConfirmacaoBilateral />}
          {abaAtiva === 'credencial' && <CredencialFuncional />}
        </>
      )}

      {/* Telas do Frentista */}
      {isFrentista && (
        <>
          {abaAtiva === 'validar' && (
            <ValidarCodigoAbt
              onProsseguirAbastecimento={(aut) => {
                setAutorizacaoFrentista(aut);
                setAbaAtiva('abastecer');
              }}
            />
          )}
          {abaAtiva === 'abastecer' && (
            <RegistrarAbastecimento
              autorizacaoPrevia={autorizacaoFrentista}
              onVoltar={() => setAbaAtiva('validar')}
            />
          )}
        </>
      )}
    </MobileLayout>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
