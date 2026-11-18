'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function AuthPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [fullName, setFullName] = useState('');
  const [crpNumber, setCrpNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.push('/dashboard');
      }
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (isRegister) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('Não foi possível criar o usuário.');

        const { error: profileError } = await supabase
          .from('psychologists')
          .insert({
            id: authData.user.id,
            full_name: fullName.trim(),
            crp_number: crpNumber.trim(),
            email: email.trim(),
            plan_tier: 'free',
          });

        if (profileError) {
          if (profileError.message.includes('crp_number')) {
            throw new Error('Este número de CRP já está cadastrado.');
          }
          throw profileError;
        }

        router.push('/dashboard');
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (loginError) {
          throw new Error('E-mail ou senha incorretos.');
        }

        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ocorreu um erro inesperado.';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Logo Prontuário Clínico"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
            className="h-28 w-auto mx-auto mb-4 object-contain"
          />
          <span className="inline-block px-3 py-1 bg-teal-50 text-teal-700 text-xs font-semibold rounded-full mb-2">
            CFP 01/2009 • LGPD
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Prontuário Clínico</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isRegister
              ? 'Crie sua conta profissional para gerenciar seus pacientes'
              : 'Acesse seu consultório digital com segurança'}
          </p>
        </div>

        <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-lg mb-6">
          <button
            type="button"
            onClick={() => { setIsRegister(false); setErrorMsg(''); }}
            className={`py-2 text-sm font-medium rounded-md transition ${
              !isRegister ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setErrorMsg(''); }}
            className={`py-2 text-sm font-medium rounded-md transition ${
              isRegister ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Criar Conta
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Dra. Ana Paula Silva"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Número do CRP
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 06/123456"
                  value={crpNumber}
                  onChange={(e) => setCrpNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              E-mail profissional
            </label>
            <input
              type="email"
              required
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Senha (mínimo 6 caracteres)
            </label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-lg transition disabled:opacity-50"
          >
            {loading
              ? 'Aguarde...'
              : isRegister
              ? 'Cadastrar e Acessar Painel'
              : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}