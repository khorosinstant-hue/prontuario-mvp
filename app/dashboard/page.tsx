'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

interface PsychologistProfile {
  id: string;
  full_name: string;
  crp_number: string;
  plan_tier: string;
}

interface Patient {
  id: string;
  full_name: string;
  social_name: string | null;
  birth_date: string;
  phone: string;
  email: string | null;
  is_minor: boolean;
  guardian_name: string | null;
  lgpd_consent_accepted: boolean;
  status: string;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<PsychologistProfile | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Edição do perfil profissional (Nome e CRP)
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editCrpNumber, setEditCrpNumber] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState('');

  // Controle do formulário de novo paciente
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Campos do paciente
  const [fullName, setFullName] = useState('');
  const [socialName, setSocialName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Contato de emergência
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');

  // Responsável (menor de idade)
  const [isMinor, setIsMinor] = useState(false);
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianCpf, setGuardianCpf] = useState('');
  const [guardianRelation, setGuardianRelation] = useState('');

  // Termo LGPD
  const [lgpdAccepted, setLgpdAccepted] = useState(false);

  const loadData = useCallback(async () => {
    setDbError('');
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/');
      return;
    }

    setUserId(user.id);

    const { data: profileData, error: profileError } = await supabase
      .from('psychologists')
      .select('id, full_name, crp_number, plan_tier')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      setDbError(`Erro ao ler tabela psychologists: ${profileError.message}`);
      setLoading(false);
      return;
    }

    if (profileData) {
      setProfile(profileData);
      setEditFullName(profileData.full_name);
      setEditCrpNumber(profileData.crp_number);
    } else {
      const fallbackCrp = '06/' + user.id.replace(/-/g, '').slice(0, 6);
      const { data: createdProfile, error: createError } = await supabase
        .from('psychologists')
        .insert({
          id: user.id,
          full_name: 'Psicólogo(a) Responsável',
          crp_number: fallbackCrp,
          email: user.email || '',
          plan_tier: 'free',
        })
        .select('id, full_name, crp_number, plan_tier')
        .single();

      if (createError) {
        setDbError(`Erro ao vincular perfil: ${createError.message}`);
      } else if (createdProfile) {
        setProfile(createdProfile);
        setEditFullName(createdProfile.full_name);
        setEditCrpNumber(createdProfile.crp_number);
      }
    }

    const { data: patientsData, error: patientsError } = await supabase
      .from('patients')
      .select('*')
      .eq('psychologist_id', user.id)
      .order('created_at', { ascending: false });

    if (patientsError) {
      setDbError(`Erro ao carregar pacientes: ${patientsError.message}`);
    } else if (patientsData) {
      setPatients(patientsData);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setSavingProfile(true);
    setDbError('');

    try {
      const { error } = await supabase
        .from('psychologists')
        .update({
          full_name: editFullName.trim(),
          crp_number: editCrpNumber.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) {
        if (error.message.includes('crp_number')) {
          throw new Error('Este número de CRP já está em uso por outro cadastro.');
        }
        throw error;
      }

      setShowProfileEdit(false);
      setProfileFeedback('Dados profissionais atualizados com sucesso!');
      setTimeout(() => setProfileFeedback(''), 4000);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar perfil.';
      setDbError(msg);
    } finally {
      setSavingProfile(false);
    }
  }

  function handleBirthDateChange(value: string) {
    setBirthDate(value);
    if (!value) return;

    const today = new Date();
    const birth = new Date(value + 'T00:00:00');
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    setIsMinor(age < 18);
  }

  function calculateAge(dateStr: string) {
    const today = new Date();
    const birth = new Date(dateStr + 'T00:00:00');
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  function resetForm() {
    setFullName('');
    setSocialName('');
    setBirthDate('');
    setCpf('');
    setPhone('');
    setEmail('');
    setEmergencyName('');
    setEmergencyPhone('');
    setEmergencyRelation('');
    setIsMinor(false);
    setGuardianName('');
    setGuardianPhone('');
    setGuardianCpf('');
    setGuardianRelation('');
    setLgpdAccepted(false);
    setFormError('');
  }

  async function handleCreatePatient(e: React.FormEvent) {
    e.preventDefault();
    const activePsychologistId = profile?.id || userId;

    if (!activePsychologistId) {
      setFormError('Sessão expirada. Clique em Sair e entre novamente.');
      return;
    }

    if (!lgpdAccepted) {
      setFormError('É obrigatório confirmar o consentimento LGPD antes de salvar.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const { data: newPatient, error } = await supabase
        .from('patients')
        .insert({
          psychologist_id: activePsychologistId,
          full_name: fullName.trim(),
          social_name: socialName.trim() || null,
          birth_date: birthDate,
          cpf: cpf.trim() || null,
          phone: phone.trim(),
          email: email.trim() || null,
          emergency_contact_name: emergencyName.trim(),
          emergency_contact_phone: emergencyPhone.trim(),
          emergency_contact_relationship: emergencyRelation.trim() || null,
          is_minor: isMinor,
          guardian_name: isMinor ? guardianName.trim() : null,
          guardian_phone: isMinor ? guardianPhone.trim() : null,
          guardian_cpf: isMinor ? guardianCpf.trim() || null : null,
          guardian_relationship: isMinor ? guardianRelation.trim() || null : null,
          lgpd_consent_accepted: true,
          lgpd_consent_at: new Date().toISOString(),
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      if (newPatient) {
        await supabase.from('audit_logs').insert({
          psychologist_id: activePsychologistId,
          patient_id: newPatient.id,
          action: 'CREATE_PATIENT',
          metadata: { is_minor: isMinor },
        });
      }

      resetForm();
      setShowForm(false);
      await loadData();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Erro ao cadastrar paciente.';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  const filteredPatients = patients.filter((p) =>
    p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.social_name && p.social_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">
        Carregando consultório...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
            className="h-20 w-auto object-contain"
          />
          <div>
            <h1 className="text-lg font-bold text-slate-900">Prontuário Clínico</h1>
            {profile && (
              <p className="text-xs text-slate-500">
                {profile.full_name} • CRP {profile.crp_number}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-semibold rounded-full uppercase">
            Plano {profile?.plan_tier || 'free'}
          </span>
          <button
            onClick={() => setShowProfileEdit(!showProfileEdit)}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
          >
            {showProfileEdit ? 'Fechar Perfil' : 'Editar Perfil'}
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 border border-slate-200 rounded-lg transition"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {profileFeedback && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl">
            {profileFeedback}
          </div>
        )}

        {dbError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl">
            <strong>Aviso:</strong> {dbError}
          </div>
        )}

        {showProfileEdit && (
          <form
            onSubmit={handleUpdateProfile}
            className="bg-white rounded-xl border border-teal-200 p-5 shadow-sm space-y-4"
          >
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Dados Profissionais (exibidos no prontuário e no PDF)
              </h3>
              <p className="text-xs text-slate-500">
                Atualize seu nome completo e número de registro no Conselho Regional de Psicologia.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nome completo profissional *
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Número do CRP *
                </label>
                <input
                  type="text"
                  required
                  value={editCrpNumber}
                  onChange={(e) => setEditCrpNumber(e.target.value)}
                  placeholder="Ex: 06/123456"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowProfileEdit(false)}
                className="px-4 py-1.5 text-xs text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
              >
                {savingProfile ? 'Salvando...' : 'Salvar Perfil'}
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Pacientes ({patients.length})</h2>
            <p className="text-sm text-slate-500">
              Gerencie cadastros e acesse os prontuários individuais
            </p>
          </div>

          <button
            onClick={() => { setShowForm(!showForm); setFormError(''); }}
            className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition shadow-sm"
          >
            {showForm ? 'Cancelar Cadastro' : '+ Novo Paciente'}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreatePatient}
            className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6"
          >
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-semibold text-slate-900">
                Novo Cadastro de Paciente
              </h3>
              <p className="text-xs text-slate-500">
                Campos marcados com * são obrigatórios conforme Resolução CFP nº 01/2009.
              </p>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {formError}
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-slate-800 mb-3">
                1. Identificação e Contato
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nome completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nome civil completo"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nome social (opcional)
                  </label>
                  <input
                    type="text"
                    value={socialName}
                    onChange={(e) => setSocialName(e.target.value)}
                    placeholder="Como prefere ser chamado(a)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Data de nascimento *
                  </label>
                  <input
                    type="date"
                    required
                    value={birthDate}
                    onChange={(e) => handleBirthDateChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Telefone / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    CPF (opcional)
                  </label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    E-mail (opcional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="paciente@email.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">
                2. Contato de Emergência
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nome do contato *
                  </label>
                  <input
                    type="text"
                    required
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    placeholder="Ex: Maria Souza"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Telefone de emergência *
                  </label>
                  <input
                    type="tel"
                    required
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="(11) 98888-8888"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Vínculo / Parentesco
                  </label>
                  <input
                    type="text"
                    value={emergencyRelation}
                    onChange={(e) => setEmergencyRelation(e.target.value)}
                    placeholder="Ex: Mãe, Cônjuge, Irmão"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMinor}
                  onChange={(e) => setIsMinor(e.target.checked)}
                  className="w-4 h-4 text-teal-700 rounded border-slate-300"
                />
                <span className="text-sm font-medium text-slate-800">
                  Paciente menor de 18 anos (ou sob curatela)
                </span>
              </label>

              {isMinor && (
                <div className="mt-4 p-4 bg-amber-50/70 border border-amber-200 rounded-lg space-y-3">
                  <p className="text-xs font-semibold text-amber-800">
                    Dados obrigatórios do Responsável Legal:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Nome completo do responsável *
                      </label>
                      <input
                        type="text"
                        required={isMinor}
                        value={guardianName}
                        onChange={(e) => setGuardianName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Telefone do responsável *
                      </label>
                      <input
                        type="tel"
                        required={isMinor}
                        value={guardianPhone}
                        onChange={(e) => setGuardianPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        CPF do responsável
                      </label>
                      <input
                        type="text"
                        value={guardianCpf}
                        onChange={(e) => setGuardianCpf(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Grau de parentesco
                      </label>
                      <input
                        type="text"
                        value={guardianRelation}
                        onChange={(e) => setGuardianRelation(e.target.value)}
                        placeholder="Ex: Mãe, Pai, Tutor legal"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-start gap-2.5 cursor-pointer bg-slate-50 p-3 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  required
                  checked={lgpdAccepted}
                  onChange={(e) => setLgpdAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-teal-700 rounded border-slate-300"
                />
                <span className="text-xs text-slate-700 leading-relaxed">
                  <strong>Consentimento LGPD e Sigilo Profissional *:</strong> Confirmo que o paciente (ou seu responsável legal) foi informado sobre a guarda sigilosa dos registros psicológicos conforme a Resolução CFP nº 01/2009 e autorizou o tratamento de seus dados pessoais.
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { resetForm(); setShowForm(false); }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar Paciente'}
              </button>
            </div>
          </form>
        )}

        {patients.length > 0 && (
          <div>
            <input
              type="text"
              placeholder="Buscar paciente por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        )}

        {filteredPatients.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <p className="text-slate-600 font-medium mb-1">
              {patients.length === 0
                ? 'Nenhum paciente cadastrado ainda'
                : 'Nenhum paciente encontrado com esse nome'}
            </p>
            <p className="text-sm text-slate-400">
              Clique no botão &quot;+ Novo Paciente&quot; acima para iniciar seu primeiro prontuário.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredPatients.map((patient) => (
              <div
                key={patient.id}
                className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-teal-300 transition"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900">
                      {patient.social_name || patient.full_name}
                    </h3>
                    {patient.social_name && (
                      <span className="text-xs text-slate-400">
                        ({patient.full_name})
                      </span>
                    )}
                    {patient.is_minor && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                        Menor de idade
                      </span>
                    )}
                    {patient.lgpd_consent_accepted && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
                        LGPD OK
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 mt-1">
                    {calculateAge(patient.birth_date)} anos • Tel: {patient.phone}
                    {patient.is_minor && patient.guardian_name
                      ? ` • Responsável: ${patient.guardian_name}`
                      : ''}
                  </p>
                </div>

                <button
                  onClick={() => router.push(`/dashboard/pacientes/${patient.id}`)}
                  className="px-4 py-2 bg-slate-100 hover:bg-teal-50 text-slate-800 hover:text-teal-800 text-sm font-medium rounded-lg transition self-start sm:self-center"
                >
                  Abrir Prontuário →
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}