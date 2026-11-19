'use client';
export const dynamic = 'force-dynamic';
export const instant = false;
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';

interface PsychologistProfile {
  id: string;
  full_name: string;
  crp_number: string;
  email: string;
}

interface Patient {
  id: string;
  full_name: string;
  social_name: string | null;
  birth_date: string;
  cpf: string | null;
  email: string | null;
  phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string | null;
  is_minor: boolean;
  guardian_name: string | null;
  guardian_cpf: string | null;
  guardian_phone: string | null;
  guardian_relationship: string | null;
  lgpd_consent_accepted: boolean;
  lgpd_consent_at: string | null;
  status: string;
  created_at: string;
}

interface Anamnesis {
  id: string;
  initial_demand: string;
  therapeutic_objectives: string;
  technical_procedures: string;
  clinical_history: string | null;
  session_frequency: string | null;
  modality: 'presencial' | 'online' | 'hibrido';
  created_at: string;
  updated_at: string;
}

interface SessionEvolution {
  id: string;
  session_number: number;
  session_date: string;
  record_type: 'session' | 'absence' | 'referral' | 'closure';
  content: string;
  modality: 'presencial' | 'online';
  is_locked: boolean;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

interface EvolutionRevision {
  id: string;
  evolution_id: string;
  previous_content: string;
  revision_reason: string;
  revised_at: string;
}

const RECORD_TYPE_LABELS: Record<SessionEvolution['record_type'], string> = {
  session: 'Sessão realizada',
  absence: 'Falta / Ausência',
  referral: 'Encaminhamento',
  closure: 'Encerramento / Alta',
};

export default function PatientRecordPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params.id as string;
  const hasLoggedView = useRef(false);

  const [profile, setProfile] = useState<PsychologistProfile | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [anamnesis, setAnamnesis] = useState<Anamnesis | null>(null);
  const [evolutions, setEvolutions] = useState<SessionEvolution[]>([]);
  const [revisions, setRevisions] = useState<Record<string, EvolutionRevision[]>>({});

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'evolutions' | 'anamnesis'>('evolutions');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Campos da Anamnese (Pilar 2)
  const [initialDemand, setInitialDemand] = useState('');
  const [therapeuticObjectives, setTherapeuticObjectives] = useState('');
  const [technicalProcedures, setTechnicalProcedures] = useState('');
  const [clinicalHistory, setClinicalHistory] = useState('');
  const [sessionFrequency, setSessionFrequency] = useState('Semanal');
  const [anamnesisModality, setAnamnesisModality] = useState<'presencial' | 'online' | 'hibrido'>('online');
  const [savingAnamnesis, setSavingAnamnesis] = useState(false);

  // Campos de Nova Evolução (Pilar 3)
  const [showEvolutionForm, setShowEvolutionForm] = useState(false);
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [recordType, setRecordType] = useState<SessionEvolution['record_type']>('session');
  const [evolutionModality, setEvolutionModality] = useState<'presencial' | 'online'>('online');
  const [evolutionContent, setEvolutionContent] = useState('');
  const [savingEvolution, setSavingEvolution] = useState(false);

  // Retificação de Evolução (CFP 01/2009)
  const [revisingId, setRevisingId] = useState<string | null>(null);
  const [revisedContent, setRevisedContent] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [savingRevision, setSavingRevision] = useState(false);

  const loadRecord = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }

    const { data: profileData } = await supabase
      .from('psychologists')
      .select('id, full_name, crp_number, email')
      .eq('id', user.id)
      .single();

    if (profileData) setProfile(profileData);

    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .eq('psychologist_id', user.id)
      .single();

    if (patientError || !patientData) {
      router.push('/dashboard');
      return;
    }

    setPatient(patientData);

    if (!hasLoggedView.current) {
      hasLoggedView.current = true;
      await supabase.from('audit_logs').insert({
        psychologist_id: user.id,
        patient_id: patientId,
        action: 'VIEW_RECORD',
      });
    }

    const { data: anamnesisData } = await supabase
      .from('anamneses')
      .select('*')
      .eq('patient_id', patientId)
      .maybeSingle();

    if (anamnesisData) {
      setAnamnesis(anamnesisData);
      setInitialDemand(anamnesisData.initial_demand);
      setTherapeuticObjectives(anamnesisData.therapeutic_objectives);
      setTechnicalProcedures(anamnesisData.technical_procedures);
      setClinicalHistory(anamnesisData.clinical_history || '');
      setSessionFrequency(anamnesisData.session_frequency || 'Semanal');
      setAnamnesisModality(anamnesisData.modality);
    }

    const { data: evoData } = await supabase
      .from('session_evolutions')
      .select('*')
      .eq('patient_id', patientId)
      .order('session_number', { ascending: false });

    if (evoData) {
      setEvolutions(evoData);

      const evoIds = evoData.map((e) => e.id);
      if (evoIds.length > 0) {
        const { data: revData } = await supabase
          .from('evolution_revisions')
          .select('*')
          .in('evolution_id', evoIds)
          .order('revised_at', { ascending: false });

        if (revData) {
          const grouped: Record<string, EvolutionRevision[]> = {};
          for (const rev of revData) {
            if (!grouped[rev.evolution_id]) grouped[rev.evolution_id] = [];
            grouped[rev.evolution_id].push(rev);
          }
          setRevisions(grouped);
        }
      }
    }

    setLoading(false);
  }, [patientId, router]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  function showTemporaryFeedback(msg: string) {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(''), 4000);
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

  async function handleSaveAnamnesis(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !patient) return;

    setSavingAnamnesis(true);
    setErrorMsg('');

    try {
      if (anamnesis) {
        const { error } = await supabase
          .from('anamneses')
          .update({
            initial_demand: initialDemand.trim(),
            therapeutic_objectives: therapeuticObjectives.trim(),
            technical_procedures: technicalProcedures.trim(),
            clinical_history: clinicalHistory.trim() || null,
            session_frequency: sessionFrequency.trim() || null,
            modality: anamnesisModality,
            updated_at: new Date().toISOString(),
          })
          .eq('id', anamnesis.id);

        if (error) throw error;

        await supabase.from('audit_logs').insert({
          psychologist_id: profile.id,
          patient_id: patient.id,
          action: 'UPDATE_ANAMNESIS',
        });

        showTemporaryFeedback('Anamnese atualizada com sucesso.');
      } else {
        const { error } = await supabase.from('anamneses').insert({
          patient_id: patient.id,
          psychologist_id: profile.id,
          initial_demand: initialDemand.trim(),
          therapeutic_objectives: therapeuticObjectives.trim(),
          technical_procedures: technicalProcedures.trim(),
          clinical_history: clinicalHistory.trim() || null,
          session_frequency: sessionFrequency.trim() || null,
          modality: anamnesisModality,
        });

        if (error) throw error;

        await supabase.from('audit_logs').insert({
          psychologist_id: profile.id,
          patient_id: patient.id,
          action: 'CREATE_ANAMNESIS',
        });

        showTemporaryFeedback('Anamnese inicial registrada com sucesso.');
      }

      await loadRecord();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Erro ao salvar anamnese.';
      setErrorMsg(msg);
    } finally {
      setSavingAnamnesis(false);
    }
  }

  async function handleCreateEvolution(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !patient) return;

    setSavingEvolution(true);
    setErrorMsg('');

    const nextNumber =
      evolutions.length > 0
        ? Math.max(...evolutions.map((ev) => ev.session_number)) + 1
        : 1;

    try {
      const { error } = await supabase.from('session_evolutions').insert({
        patient_id: patient.id,
        psychologist_id: profile.id,
        session_number: nextNumber,
        session_date: new Date(sessionDate).toISOString(),
        record_type: recordType,
        modality: evolutionModality,
        content: evolutionContent.trim(),
        is_locked: false,
      });

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        psychologist_id: profile.id,
        patient_id: patient.id,
        action: 'CREATE_EVOLUTION',
        metadata: { session_number: nextNumber, record_type: recordType },
      });

      setEvolutionContent('');
      setShowEvolutionForm(false);
      showTemporaryFeedback(`Registro da sessão #${nextNumber} salvo.`);
      await loadRecord();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Erro ao salvar evolução.';
      setErrorMsg(msg);
    } finally {
      setSavingEvolution(false);
    }
  }

  async function handleLockEvolution(evo: SessionEvolution) {
    if (!profile || !patient) return;

    const { error } = await supabase
      .from('session_evolutions')
      .update({
        is_locked: true,
        locked_at: new Date().toISOString(),
      })
      .eq('id', evo.id);

    if (!error) {
      showTemporaryFeedback(`Sessão #${evo.session_number} assinada e bloqueada.`);
      await loadRecord();
    }
  }

  async function handleSaveRevision(evo: SessionEvolution) {
    if (!profile || !patient) return;

    if (!revisionReason.trim()) {
      setErrorMsg('Informe o motivo técnico da retificação (exigência CFP).');
      return;
    }

    setSavingRevision(true);
    setErrorMsg('');

    try {
      const { error: revError } = await supabase
        .from('evolution_revisions')
        .insert({
          evolution_id: evo.id,
          previous_content: evo.content,
          revision_reason: revisionReason.trim(),
        });

      if (revError) throw revError;

      const { error: updError } = await supabase
        .from('session_evolutions')
        .update({
          content: revisedContent.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', evo.id);

      if (updError) throw updError;

      await supabase.from('audit_logs').insert({
        psychologist_id: profile.id,
        patient_id: patient.id,
        action: 'UPDATE_EVOLUTION',
        metadata: { session_number: evo.session_number, reason: revisionReason.trim() },
      });

      setRevisingId(null);
      setRevisedContent('');
      setRevisionReason('');
      showTemporaryFeedback(`Retificação da sessão #${evo.session_number} registrada.`);
      await loadRecord();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Erro ao registrar retificação.';
      setErrorMsg(msg);
    } finally {
      setSavingRevision(false);
    }
  }

  async function handleExportJSON() {
    if (!profile || !patient) return;

    const payload = {
      exported_at: new Date().toISOString(),
      compliance: 'Resolução CFP nº 01/2009 e LGPD (Lei 13.709/2018)',
      psychologist: {
        full_name: profile.full_name,
        crp_number: profile.crp_number,
        email: profile.email,
      },
      patient,
      anamnesis,
      session_evolutions: evolutions.map((ev) => ({
        ...ev,
        revisions: revisions[ev.id] || [],
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = patient.full_name.toLowerCase().replace(/\s+/g, '_');
    a.href = url;
    a.download = `prontuario_${safeName}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    await supabase.from('audit_logs').insert({
      psychologist_id: profile.id,
      patient_id: patient.id,
      action: 'EXPORT_JSON',
    });

    showTemporaryFeedback('Arquivo JSON exportado e registrado na auditoria.');
  }

  async function handleExportPDF() {
    if (!profile || !patient) return;

    await supabase.from('audit_logs').insert({
      psychologist_id: profile.id,
      patient_id: patient.id,
      action: 'EXPORT_PDF',
    });

    window.print();
  }

  if (loading || !patient) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">
        Carregando prontuário...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition"
          >
            ← Voltar
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
            className="h-16 w-auto object-contain"
          />
          <div>
            <h1 className="text-base font-bold text-slate-900">
              Prontuário Psicológico
            </h1>
            {profile && (
              <p className="text-xs text-slate-500">
                {profile.full_name} • CRP {profile.crp_number}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJSON}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            Exportar JSON (LGPD)
          </button>
          <button
            onClick={handleExportPDF}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition"
          >
            Exportar PDF (CRP)
          </button>
        </div>
      </header>

      {/* Cabeçalho formal visível apenas na impressão PDF */}
      <div className="hidden print:flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-6 p-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            PRONTUÁRIO PSICOLÓGICO — DOCUMENTO SIGILOSO
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Emitido conforme Resolução CFP nº 01/2009 e Lei Geral de Proteção de Dados (LGPD)
          </p>
          {profile && (
            <p className="text-sm font-medium text-slate-800 mt-2">
              Profissional Responsável: {profile.full_name} — CRP {profile.crp_number}
            </p>
          )}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Logo"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
          className="h-24 w-auto object-contain"
        />
      </div>

      <main className="max-w-5xl mx-auto p-6 space-y-6 print:p-6">
        {feedbackMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg print:hidden">
            {feedbackMsg}
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg print:hidden">
            {errorMsg}
          </div>
        )}

        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm print:shadow-none print:border-slate-300">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900">
                  {patient.social_name || patient.full_name}
                </h2>
                {patient.social_name && (
                  <span className="text-xs text-slate-500">
                    (Nome civil: {patient.full_name})
                  </span>
                )}
                {patient.is_minor && (
                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                    Menor de idade
                  </span>
                )}
              </div>

              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-xs text-slate-600">
                <p>
                  <strong>Nascimento:</strong>{' '}
                  {new Date(patient.birth_date + 'T00:00:00').toLocaleDateString('pt-BR')} (
                  {calculateAge(patient.birth_date)} anos)
                </p>
                <p>
                  <strong>Telefone:</strong> {patient.phone}
                </p>
                {patient.cpf && (
                  <p>
                    <strong>CPF:</strong> {patient.cpf}
                  </p>
                )}
                <p>
                  <strong>Emergência:</strong> {patient.emergency_contact_name} (
                  {patient.emergency_contact_phone})
                </p>
                {patient.is_minor && patient.guardian_name && (
                  <p className="text-amber-800 font-medium sm:col-span-2">
                    <strong>Responsável Legal:</strong> {patient.guardian_name} • Tel:{' '}
                    {patient.guardian_phone}
                  </p>
                )}
              </div>
            </div>

            <div className="text-right text-xs text-slate-400">
              <p>Consentimento LGPD aceito</p>
              {patient.lgpd_consent_at && (
                <p>{new Date(patient.lgpd_consent_at).toLocaleDateString('pt-BR')}</p>
              )}
            </div>
          </div>
        </section>

        <div className="flex border-b border-slate-200 gap-6 print:hidden">
          <button
            onClick={() => setActiveTab('evolutions')}
            className={`pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'evolutions'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Evolução das Sessões ({evolutions.length})
          </button>
          <button
            onClick={() => setActiveTab('anamnesis')}
            className={`pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'anamnesis'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Anamnese / Avaliação Inicial {anamnesis ? '✓' : '(Pendente)'}
          </button>
        </div>

        <section
          className={`${
            activeTab === 'anamnesis' ? 'block' : 'hidden print:block'
          } bg-white rounded-xl border border-slate-200 p-6 shadow-sm print:shadow-none print:border-slate-300`}
        >
          <div className="border-b border-slate-100 pb-3 mb-4">
            <h3 className="text-lg font-bold text-slate-900">
              Anamnese e Plano Terapêutico (CFP 01/2009)
            </h3>
            <p className="text-xs text-slate-500 print:hidden">
              Registro inicial da demanda, objetivos e procedimentos técnicos previstos.
            </p>
          </div>

          <form onSubmit={handleSaveAnamnesis} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Demanda inicial / Motivo da procura *
              </label>
              <textarea
                required
                rows={3}
                value={initialDemand}
                onChange={(e) => setInitialDemand(e.target.value)}
                placeholder="Descreva a queixa principal e o contexto de busca pelo atendimento..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Objetivos terapêuticos *
              </label>
              <textarea
                required
                rows={3}
                value={therapeuticObjectives}
                onChange={(e) => setTherapeuticObjectives(e.target.value)}
                placeholder="Metas clínicas pactuadas com o paciente..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Procedimentos técnicos / Abordagem *
              </label>
              <textarea
                required
                rows={2}
                value={technicalProcedures}
                onChange={(e) => setTechnicalProcedures(e.target.value)}
                placeholder="Ex: Psicoterapia individual com base na Terapia Cognitivo-Comportamental..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Histórico clínico / Observações relevantes (opcional)
              </label>
              <textarea
                rows={3}
                value={clinicalHistory}
                onChange={(e) => setClinicalHistory(e.target.value)}
                placeholder="Histórico de saúde, medicações em uso, atendimentos anteriores..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Frequência combinada
                </label>
                <input
                  type="text"
                  value={sessionFrequency}
                  onChange={(e) => setSessionFrequency(e.target.value)}
                  placeholder="Ex: Semanal, Quinzenal"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Modalidade de atendimento
                </label>
                <select
                  value={anamnesisModality}
                  onChange={(e) =>
                    setAnamnesisModality(
                      e.target.value as 'presencial' | 'online' | 'hibrido'
                    )
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
                >
                  <option value="online">Online (Telepsicologia)</option>
                  <option value="presencial">Presencial</option>
                  <option value="hibrido">Híbrido</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2 print:hidden">
              <button
                type="submit"
                disabled={savingAnamnesis}
                className="px-6 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
              >
                {savingAnamnesis
                  ? 'Salvando...'
                  : anamnesis
                  ? 'Atualizar Anamnese'
                  : 'Salvar Anamnese'}
              </button>
            </div>
          </form>
        </section>

        <section
          className={`${
            activeTab === 'evolutions' ? 'block' : 'hidden print:block'
          } space-y-4`}
        >
          <div className="flex items-center justify-between print:hidden">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Registro de Evolução das Sessões
              </h3>
              <p className="text-xs text-slate-500">
                Anotações sucintas do trabalho realizado conforme Art. 1º da Res. CFP 01/2009.
              </p>
            </div>

            <button
              onClick={() => setShowEvolutionForm(!showEvolutionForm)}
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition shadow-sm"
            >
              {showEvolutionForm ? 'Cancelar' : '+ Nova Evolução'}
            </button>
          </div>

          <h3 className="hidden print:block text-lg font-bold text-slate-900 pt-4">
            Evolução Cronológica das Sessões ({evolutions.length})
          </h3>

          {showEvolutionForm && (
            <form
              onSubmit={handleCreateEvolution}
              className="bg-white rounded-xl border border-teal-200 p-5 shadow-sm space-y-4 print:hidden"
            >
              <h4 className="text-sm font-bold text-slate-900">
                Registrar Sessão #
                {evolutions.length > 0
                  ? Math.max(...evolutions.map((e) => e.session_number)) + 1
                  : 1}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Data e hora *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tipo de registro *
                  </label>
                  <select
                    value={recordType}
                    onChange={(e) =>
                      setRecordType(e.target.value as SessionEvolution['record_type'])
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
                  >
                    <option value="session">Sessão realizada</option>
                    <option value="absence">Falta / Ausência</option>
                    <option value="referral">Encaminhamento</option>
                    <option value="closure">Encerramento / Alta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Modalidade *
                  </label>
                  <select
                    value={evolutionModality}
                    onChange={(e) =>
                      setEvolutionModality(e.target.value as 'presencial' | 'online')
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
                  >
                    <option value="online">Online</option>
                    <option value="presencial">Presencial</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Evolução clínica (registro sucinto e objetivo) *
                </label>
                <textarea
                  required
                  rows={4}
                  value={evolutionContent}
                  onChange={(e) => setEvolutionContent(e.target.value)}
                  placeholder="Temas trabalhados, intervenções realizadas, encaminhamentos ou justificativa de ausência..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEvolutionForm(false)}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEvolution}
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                >
                  {savingEvolution ? 'Salvando...' : 'Salvar Evolução'}
                </button>
              </div>
            </form>
          )}

          {evolutions.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <p className="text-slate-600 font-medium text-sm">
                Nenhuma evolução registrada para este paciente ainda.
              </p>
              <p className="text-xs text-slate-400 mt-1 print:hidden">
                Clique em &quot;+ Nova Evolução&quot; para registrar o primeiro atendimento.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {evolutions.map((evo) => {
                const evoRevisions = revisions[evo.id] || [];
                const isRevisingThis = revisingId === evo.id;

                return (
                  <div
                    key={evo.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 print:border-slate-300"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 bg-slate-900 text-white text-xs font-bold rounded">
                          Sessão #{evo.session_number}
                        </span>
                        <span className="text-xs font-medium text-slate-700">
                          {new Date(evo.session_date).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                        <span className="px-2 py-0.5 bg-teal-50 text-teal-800 text-xs rounded-full">
                          {RECORD_TYPE_LABELS[evo.record_type]}
                        </span>
                        <span className="text-xs text-slate-400 capitalize">
                          • {evo.modality}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 print:hidden">
                        {evo.is_locked ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded">
                            Assinado / Bloqueado
                          </span>
                        ) : (
                          <button
                            onClick={() => handleLockEvolution(evo)}
                            className="px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded transition"
                          >
                            Assinar e Bloquear
                          </button>
                        )}

                        {!isRevisingThis && (
                          <button
                            onClick={() => {
                              setRevisingId(evo.id);
                              setRevisedContent(evo.content);
                              setRevisionReason('');
                            }}
                            className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded transition"
                          >
                            Retificar
                          </button>
                        )}
                      </div>
                    </div>

                    {isRevisingThis ? (
                      <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-4 space-y-3">
                        <p className="text-xs font-semibold text-amber-900">
                          Retificação de Registro (o texto original ficará preservado no histórico):
                        </p>
                        <textarea
                          rows={3}
                          value={revisedContent}
                          onChange={(e) => setRevisedContent(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Motivo obrigatório da retificação (ex: Complementação técnica)..."
                          value={revisionReason}
                          onChange={(e) => setRevisionReason(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setRevisingId(null)}
                            className="px-3 py-1.5 text-xs text-slate-600"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={savingRevision}
                            onClick={() => handleSaveRevision(evo)}
                            className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-medium rounded-lg"
                          >
                            {savingRevision ? 'Salvando...' : 'Confirmar Retificação'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                        {evo.content}
                      </p>
                    )}

                    {evoRevisions.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <p className="text-xs font-semibold text-slate-500">
                          Histórico de retificações ({evoRevisions.length}):
                        </p>
                        {evoRevisions.map((rev) => (
                          <div
                            key={rev.id}
                            className="bg-slate-50 p-2.5 rounded border border-slate-200 text-xs text-slate-600"
                          >
                            <p className="font-medium text-slate-700">
                              Em {new Date(rev.revised_at).toLocaleString('pt-BR')} — Motivo:{' '}
                              {rev.revision_reason}
                            </p>
                            <p className="mt-1 text-slate-500 italic">
                              Texto anterior: &quot;{rev.previous_content}&quot;
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}