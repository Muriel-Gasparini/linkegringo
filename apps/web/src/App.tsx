import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { OnboardingModal } from './components/OnboardingModal';
import { ApiKeyDialog } from './components/ApiKeyDialog';
import { McpHubModal } from './components/McpHubModal';
import { FileUploadDropzone, type FileUploadData } from './components/FileUploadDropzone';
import { DiagnosticView } from './components/DiagnosticView';
import { InterviewView } from './components/InterviewView';
import { FactsConfirmation } from './components/FactsConfirmation';
import { ActionHubView } from './components/ActionHubView';
import {
  getStoredApiKey,
  setStoredApiKey,
  clearStoredApiKey,
  getStoredProviderId,
  setStoredProviderId,
  getStoredModel,
  setStoredModel,
  clearCachedGeminiModels,
  getStoredSession,
  saveStoredSession,
  clearStoredSession,
  hasSeenOnboarding,
  setOnboardingSeen,
  getStoredChatHistory,
  setStoredChatHistory,
  clearStoredChatHistory,
} from './lib/storage';
import { createAiProvider, formatCurrentDate, detectSparseExperiences } from '@linkegringo/ai';
import {
  type AiProvider,
  type CareerObjective,
  type ConfirmedFact,
  type InterviewAnswer,
  type InterviewPlan,
  type Profile,
  type ProfileAnalysis,
  type ProfileReview,
  getCandidateIdentityKey,
  evaluateScoreTransition,
} from '@linkegringo/core';
import {
  track,
  toDurationBand,
  toScoreBand,
  toScoreDeltaBand,
  categorizeApiError,
} from './lib/telemetry';

export type FlowStep = 'upload' | 'diagnostic' | 'interview' | 'facts' | 'action-hub';

interface SessionState {
  candidateKey?: string;
  step: FlowStep;
  profile?: Profile;
  review?: ProfileReview;
  objective?: CareerObjective;
  interviewPlan?: InterviewPlan;
  interviewAnswers?: InterviewAnswer[];
  interviewRound?: number;
  facts?: ConfirmedFact[];
  analysis?: ProfileAnalysis;
  chatHistory?: unknown[];
}

export function App() {
  const [apiKey, setApiKey] = useState<string>(getStoredApiKey());
  const [providerId, setProviderId] = useState<string>(getStoredProviderId());
  const [model, setModel] = useState<string>(getStoredModel());

  const [step, setStep] = useState<FlowStep>('upload');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [review, setReview] = useState<ProfileReview | null>(null);
  const [objective, setObjective] = useState<CareerObjective | null>(null);
  const [interviewPlan, setInterviewPlan] = useState<InterviewPlan | null>(null);
  const [interviewAnswers, setInterviewAnswers] = useState<InterviewAnswer[]>([]);
  const [interviewRound, setInterviewRound] = useState<number>(1);
  const [facts, setFacts] = useState<ConfirmedFact[]>([]);
  const [analysis, setAnalysis] = useState<ProfileAnalysis | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [mcpHubOpen, setMcpHubOpen] = useState(false);

  // Active AI Provider instance retention across turns and re-renders
  const providerRef = React.useRef<AiProvider | null>(null);

  const getActiveProvider = () => {
    if (!providerRef.current) {
      const provider = createAiProvider(providerId, { apiKey, model });
      const history = getStoredChatHistory();
      if (history && history.length > 0) {
        provider.restoreChatHistory?.(history);
      }
      providerRef.current = provider;
    }
    return providerRef.current;
  };

  const lastConfigRef = React.useRef({ providerId, apiKey, model });
  useEffect(() => {
    if (
      lastConfigRef.current.providerId !== providerId ||
      lastConfigRef.current.apiKey !== apiKey ||
      lastConfigRef.current.model !== model
    ) {
      lastConfigRef.current = { providerId, apiKey, model };
      if (!providerRef.current || providerRef.current.id !== providerId) {
        providerRef.current = null;
      }
    }
  }, [providerId, apiKey, model]);

  // Restore session on mount
  useEffect(() => {
    const saved = getStoredSession<SessionState>();
    if (saved && saved.profile && saved.review) {
      let safeStep: FlowStep = saved.step || 'diagnostic';
      if (safeStep === 'action-hub' && !saved.analysis) {
        safeStep = saved.facts && saved.facts.length > 0 ? 'facts' : 'diagnostic';
      } else if (safeStep === 'facts' && (!saved.facts || saved.facts.length === 0)) {
        safeStep = saved.interviewPlan ? 'interview' : 'diagnostic';
      } else if (safeStep === 'interview' && !saved.interviewPlan) {
        safeStep = 'diagnostic';
      }

      setStep(safeStep);
      setProfile(saved.profile);
      setReview(saved.review);
      if (saved.objective) setObjective(saved.objective);
      if (saved.interviewPlan) setInterviewPlan(saved.interviewPlan);
      if (saved.interviewAnswers) setInterviewAnswers(saved.interviewAnswers);
      if (saved.interviewRound) setInterviewRound(saved.interviewRound);
      if (saved.facts) setFacts(saved.facts);
      if (saved.analysis) setAnalysis(saved.analysis);

      // Restore AI chat history for session continuity across page reloads
      const savedChatHistory = saved.chatHistory || getStoredChatHistory();
      if (savedChatHistory && savedChatHistory.length > 0) {
        try {
          setStoredChatHistory(savedChatHistory);
          const provider = getActiveProvider();
          provider.restoreChatHistory?.(savedChatHistory);
        } catch {
          // Non-critical: provider may not support chat history restoration
        }
      }
    } else {
      // First time visitor check
      if (!hasSeenOnboarding()) {
        setOnboardingOpen(true);
        setOnboardingSeen(true);
      }
    }
  }, []);

  // Persist session changes
  useEffect(() => {
    if (profile && review) {
      // Retrieve chat history from the active provider if available
      let chatHistory: unknown[] | undefined;
      try {
        const history = providerRef.current?.getChatHistory?.();
        if (history && history.length > 0) {
          chatHistory = history;
        } else {
          const stored = getStoredChatHistory();
          if (stored && stored.length > 0) {
            chatHistory = stored;
          }
        }
      } catch {
        // Non-critical: provider may not support getChatHistory
      }

      const stateToSave: SessionState = {
        candidateKey: getCandidateIdentityKey(profile),
        step,
        profile,
        review,
        objective: objective || undefined,
        interviewPlan: interviewPlan || undefined,
        interviewAnswers,
        interviewRound,
        facts,
        analysis: analysis || undefined,
        chatHistory,
      };
      saveStoredSession(stateToSave);

      // Also persist chat history separately for resilience
      if (chatHistory && chatHistory.length > 0) {
        setStoredChatHistory(chatHistory);
      }
    }
  }, [step, profile, review, objective, interviewPlan, interviewAnswers, interviewRound, facts, analysis]);

  // Step 1 ➔ Step 2: Upload, Parse and Diagnose
  const handleAnalyze = async (uploadData: FileUploadData) => {
    setIsLoading(true);
    setLoadingMessage('Analisando perfil com IA multimodal...');
    setErrorMessage(null);
    const startTime = Date.now();
    track('analysis_started', { source: 'upload' });

    try {
      const provider = getActiveProvider();
      const currentDate = new Date().toISOString();

      // Unified single-turn multimodal analysis: PDF base64 + targetRole + currentDate
      const { profile: parsedProfile, review: profileReview } = await provider.parseAndDiagnose({
        pdfBase64: uploadData.pdfBase64,
        targetRole: uploadData.targetRole,
        currentDate,
      });

      const newCandidateKey = getCandidateIdentityKey(parsedProfile);
      const storedSession = getStoredSession<SessionState>();
      const prevCandidateKey = profile
        ? getCandidateIdentityKey(profile)
        : (storedSession?.candidateKey || null);

      // Candidate isolation: if a different candidate or new profile is uploaded, reset interview/facts/analysis
      if (prevCandidateKey && prevCandidateKey !== newCandidateKey) {
        setInterviewPlan(null);
        setInterviewAnswers([]);
        setInterviewRound(1);
        setFacts([]);
        setAnalysis(null);
        clearStoredChatHistory();
        clearStoredSession();
        providerRef.current = null;
      }

      const history = provider.getChatHistory?.();
      if (history && history.length > 0) {
        setStoredChatHistory(history);
      }

      setProfile(parsedProfile);
      setReview(profileReview);
      setFileName(uploadData.fileName);
      if (uploadData.targetRole) {
        setObjective({
          targetMarket: 'United States',
          primaryRole: uploadData.targetRole,
          seniority: 'senior',
          workPreference: 'remote',
          excludedTechnologies: [],
        });
      }
      const durationMs = Date.now() - startTime;
      const durationSeconds = Math.round(durationMs / 1000);
      const experienceCount = parsedProfile.experiences?.length || 0;
      const sparseExperiencesCount = detectSparseExperiences(parsedProfile.experiences || []).length;
      const gapsCount = (profileReview.primaryGaps?.length || profileReview.triageBottlenecks?.length) || 0;
      const inboundScore = profileReview.inboundReadiness?.score ?? profileReview.overallScore ?? 0;

      track('analysis_completed', {
        durationBand: toDurationBand(durationMs),
        durationSeconds,
        inboundScore,
        scoreBand: toScoreBand(inboundScore),
        experienceCount,
        sparseExperiencesCount,
        gapsCount,
      });
      setStep('diagnostic');
    } catch (err: any) {
      console.error('Erro na análise do perfil:', err);
      track('api_error', { stage: 'diagnose', errorType: categorizeApiError(err) });
      setErrorMessage(
        err?.message || 'Falha ao analisar o perfil com a IA. Verifique sua chave de API e tente novamente.',
      );
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Instant Demo Mode
  const handleLoadDemo = async (targetRole?: string) => {
    setIsLoading(true);
    setLoadingMessage('Carregando perfil de demonstração...');
    setErrorMessage(null);
    setProviderId('demo');
    setStoredProviderId('demo');
    const startTime = Date.now();
    track('pdf_uploaded', { source: 'demo', hasTargetRole: Boolean(targetRole) });
    if (targetRole) {
      track('target_role_selected', { roleCategory: targetRole, selectionMethod: 'quick_pill' });
    }
    track('analysis_started', { source: 'demo', providerType: 'demo' });

    try {
      const provider = createAiProvider('demo');
      providerRef.current = provider;
      const currentDate = new Date().toISOString();
      const { profile: demoProfile, review: demoReview } = await provider.parseAndDiagnose({
        targetRole,
        currentDate,
      });

      const demoCandidateKey = getCandidateIdentityKey(demoProfile);
      const storedSession = getStoredSession<SessionState>();
      const prevCandidateKey = profile
        ? getCandidateIdentityKey(profile)
        : (storedSession?.candidateKey || null);
      if (prevCandidateKey && prevCandidateKey !== demoCandidateKey) {
        setInterviewPlan(null);
        setInterviewAnswers([]);
        setInterviewRound(1);
        setFacts([]);
        setAnalysis(null);
        clearStoredChatHistory();
        clearStoredSession();
      }

      const history = provider.getChatHistory?.();
      if (history && history.length > 0) {
        setStoredChatHistory(history);
      }

      setProfile(demoProfile);
      setReview(demoReview);
      setFileName('perfil-demonstracao.pdf');
      setObjective({
        targetMarket: 'United States',
        primaryRole: targetRole || demoReview.profileDirection.primaryRole,
        seniority: 'senior',
        workPreference: 'remote',
        excludedTechnologies: [],
      });
      const durationMs = Date.now() - startTime;
      const durationSeconds = Math.round(durationMs / 1000);
      const experienceCount = demoProfile.experiences?.length || 0;
      const sparseExperiencesCount = detectSparseExperiences(demoProfile.experiences || []).length;
      const gapsCount = (demoReview.primaryGaps?.length || demoReview.triageBottlenecks?.length) || 0;
      const inboundScore = demoReview.inboundReadiness?.score ?? demoReview.overallScore ?? 0;

      track('analysis_completed', {
        durationBand: toDurationBand(durationMs),
        durationSeconds,
        inboundScore,
        scoreBand: toScoreBand(inboundScore),
        experienceCount,
        sparseExperiencesCount,
        gapsCount,
      });
      setStep('diagnostic');
    } catch (err: any) {
      console.error('Erro no modo demo:', err);
      track('api_error', { stage: 'diagnose', errorType: categorizeApiError(err) });
      setErrorMessage('Erro ao carregar dados de demonstração.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Step 2 ➔ Step 3: From Diagnostic directly to Interview (Eliminating intermediate Objective step)
  const handleProceedToInterview = async (chosenRole?: string) => {
    if (!profile || !review) return;
    setIsLoading(true);
    setErrorMessage(null);

    const primaryRole = chosenRole || objective?.primaryRole || review.profileDirection?.primaryRole || 'Senior Software Engineer';
    const newObjective: CareerObjective = {
      targetMarket: review.targetMarket || 'United States',
      primaryRole,
      seniority: 'senior',
      workPreference: 'remote',
      excludedTechnologies: [],
    };
    setObjective(newObjective);

    try {
      const provider = getActiveProvider();
      const plan = await provider.generateInterview({
        profile,
        objective: newObjective,
        review,
        currentDate: formatCurrentDate(),
      });

      const history = provider.getChatHistory?.();
      if (history && history.length > 0) {
        setStoredChatHistory(history);
      }

      setInterviewPlan(plan);
      setInterviewRound(1);
      setStep('interview');
    } catch (err: any) {
      console.error('Erro ao gerar entrevista:', err);
      setErrorMessage(err?.message || 'Falha ao gerar perguntas da entrevista.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3 ➔ Step 4: Submit Interview Answers to Facts or Next Round
  const handleSubmitAnswers = async (answers: InterviewAnswer[]) => {
    if (!profile || !objective || !interviewPlan) return;
    setIsLoading(true);
    setErrorMessage(null);
    setInterviewAnswers((prev) => [...prev, ...answers]);

    try {
      const provider = getActiveProvider();
      const progress = await provider.evaluateProgress({
        profile,
        objective,
        plan: interviewPlan,
        answers,
        previousFacts: facts,
        roundNumber: interviewRound,
        currentDate: formatCurrentDate(),
      });

      const history = provider.getChatHistory?.();
      if (history && history.length > 0) {
        setStoredChatHistory(history);
      }

      // Merge newly extracted facts with existing facts
      const mergedFacts = [...facts];
      for (const newFact of progress.facts) {
        if (!mergedFacts.some((f) => f.id === newFact.id || f.statement === newFact.statement)) {
          mergedFacts.push(newFact);
        }
      }
      setFacts(mergedFacts);

      // Multi-round progression: if AI determines candidate needs deeper technical evidence (max 2 rounds)
      if (
        progress.readyForGeneration === false &&
        progress.questions &&
        progress.questions.length > 0 &&
        interviewRound < 2
      ) {
        setInterviewPlan({ questions: progress.questions });
        setInterviewRound((prev) => prev + 1);
        setStep('interview');
      } else {
        setStep('facts');
      }
    } catch (err: any) {
      console.error('Erro ao avaliar entrevista:', err);
      setErrorMessage(err?.message || 'Falha ao processar as respostas da entrevista.');
    } finally {
      setIsLoading(false);
    }
  };

  // User action: skip remaining questions and proceed directly to facts confirmation
  const handleSkipToFacts = () => {
    // If skipping before facts were extracted, generate baseline facts from profile
    if (facts.length === 0 && profile) {
      const baselineFacts: ConfirmedFact[] = [];
      profile.experiences.forEach((exp, i) => {
        baselineFacts.push({
          id: `profile-exp-${i}`,
          statement: `Atuou como ${exp.title} na empresa ${exp.companyName}${
            exp.description ? `: ${exp.description.replace(/\n+/g, ' ').slice(0, 140)}` : ''
          }`,
          source: 'linkedin-profile',
          sourceReference: `Experiência: ${exp.companyName}`,
          confirmed: true,
        });
      });
      if (profile.skills && profile.skills.length > 0) {
        baselineFacts.push({
          id: 'profile-skills-baseline',
          statement: `Domínio comprovado das tecnologias: ${profile.skills
            .slice(0, 8)
            .map((s) => s.name)
            .join(', ')}`,
          source: 'linkedin-profile',
          sourceReference: 'Skills do Perfil',
          confirmed: true,
        });
      }
      if (baselineFacts.length > 0) {
        setFacts(baselineFacts);
      }
    }
    track('interview_skipped', {
      reason: 'user_opt_out',
      questionsOffered: interviewPlan?.questions?.length || 0,
    });
    setStep('facts');
  };

  // Step 4 ➔ Step 5: Confirm Facts and Generate Action Hub Profile
  const handleConfirmFactsAndGenerate = async (confirmedFacts: ConfirmedFact[]) => {
    if (!profile) return;
    setIsLoading(true);
    setErrorMessage(null);
    setFacts(confirmedFacts);
    const rewriteStartTime = Date.now();

    const activeObjective: CareerObjective = objective || {
      targetMarket: review?.targetMarket || 'United States',
      primaryRole: review?.profileDirection?.primaryRole || 'Senior Software Engineer',
      seniority: 'senior',
      workPreference: 'remote',
      excludedTechnologies: [],
    };

    try {
      const provider = getActiveProvider();
      const finalAnalysis = await provider.generateRewrittenProfile({
        profile,
        objective: activeObjective,
        confirmedFacts,
        initialReview: review || undefined,
        currentDate: formatCurrentDate(),
        interviewAnswers,
      });

      const initialScore = review?.overallScore ?? finalAnalysis.initialScore ?? 42;
      const initialScores = review?.scores;

      const stabilizedScores = evaluateScoreTransition(
        { overallScore: initialScore, scores: initialScores },
        { overallScore: finalAnalysis.overallScore, scores: finalAnalysis.scores },
        { noiseBand: 2, monotonic: true },
      );

      const stabilizedAnalysis: ProfileAnalysis = {
        ...finalAnalysis,
        overallScore: stabilizedScores.overallScore,
        scores: stabilizedScores.scores || finalAnalysis.scores,
      };

      const history = provider.getChatHistory?.();
      if (history && history.length > 0) {
        setStoredChatHistory(history);
      }

      setAnalysis(stabilizedAnalysis);
      const durationSeconds = Math.round((Date.now() - rewriteStartTime) / 1000);
      const finalScore = stabilizedAnalysis.overallScore;
      const scoreDelta = finalScore - initialScore;
      track('rewrite_completed', {
        durationSeconds,
        initialScore,
        finalScore,
        scoreDelta,
        scoreDeltaBand: toScoreDeltaBand(scoreDelta),
      });
      setStep('action-hub');
    } catch (err: any) {
      console.error('Erro ao gerar perfil final:', err);
      track('api_error', { stage: 'rewrite', errorType: categorizeApiError(err) });
      setErrorMessage(err?.message || 'Falha ao gerar perfil otimizado.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset Session
  const handleResetSession = () => {
    providerRef.current = null;
    clearStoredSession();
    clearStoredChatHistory();
    setStep('upload');
    setProfile(null);
    setReview(null);
    setObjective(null);
    setInterviewPlan(null);
    setInterviewAnswers([]);
    setInterviewRound(1);
    setFacts([]);
    setAnalysis(null);
    setFileName(null);
    setLoadingMessage('');
    setErrorMessage(null);
  };

  // Toggle Demo Mode from Header
  const handleToggleDemoMode = () => {
    providerRef.current = null;
    if (providerId === 'demo') {
      setProviderId('gemini');
      setStoredProviderId('gemini');
    } else {
      setProviderId('demo');
      setStoredProviderId('demo');
    }
  };

  // Save API Key, Provider & Model from Dialog
  const handleSaveApiKey = (newKey: string, newProviderId: string, newModel?: string) => {
    providerRef.current = null;
    setApiKey(newKey);
    setStoredApiKey(newKey);
    setProviderId(newProviderId);
    setStoredProviderId(newProviderId);
    if (newModel) {
      setModel(newModel);
      setStoredModel(newModel);
    }
  };

  const handleClearApiKey = () => {
    providerRef.current = null;
    setApiKey('');
    clearStoredApiKey();
    clearCachedGeminiModels();
    setModel('gemini-3.5-flash');
    setStoredModel('gemini-3.5-flash');
  };

  const hasActiveSession = Boolean(profile && review);

  return (
    <div className="min-h-screen flex flex-col bg-[#090D14] text-slate-100">
      <Header
        apiKey={apiKey}
        providerId={providerId}
        model={model}
        onOpenApiKeyDialog={() => setApiKeyDialogOpen(true)}
        onOpenOnboarding={() => setOnboardingOpen(true)}
        onOpenMcpHub={() => {
          setMcpHubOpen(true);
          track('mcp_modal_opened');
        }}
        onToggleDemoMode={handleToggleDemoMode}
        onResetSession={handleResetSession}
        hasActiveSession={hasActiveSession}
      />

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-8">
        {/* Error notification banner */}
        {errorMessage && (
          <div className="max-w-3xl mx-auto mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center justify-between gap-3 text-xs sm:text-sm">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-white font-bold px-2 py-1 cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Dynamic step view */}
        {step === 'upload' && (
          <FileUploadDropzone
            onAnalyze={handleAnalyze}
            onLoadDemo={handleLoadDemo}
            isLoading={isLoading}
            loadingMessage={loadingMessage}
            onOpenApiKeyDialog={() => setApiKeyDialogOpen(true)}
            hasApiKey={Boolean(apiKey && apiKey.trim().length > 0)}
            isDemoMode={providerId === 'demo'}
          />
        )}

        {step === 'diagnostic' && profile && review && (
          <DiagnosticView
            profile={profile}
            review={review}
            targetRole={objective?.primaryRole}
            onProceedToInterview={handleProceedToInterview}
            onProceedToObjective={handleProceedToInterview}
            isProcessing={isLoading}
          />
        )}

        {step === 'interview' && interviewPlan && (
          <InterviewView
            key={`interview-round-${interviewRound}`}
            plan={interviewPlan}
            onSubmitAnswers={handleSubmitAnswers}
            onSkipToFacts={handleSkipToFacts}
            isLoading={isLoading}
            roundNumber={interviewRound}
            overallScore={review?.overallScore}
            isPolishMode={Boolean(review && review.overallScore >= 92)}
          />
        )}

        {step === 'facts' && (
          <FactsConfirmation
            facts={facts}
            onConfirmAndGenerate={handleConfirmFactsAndGenerate}
            isLoading={isLoading}
          />
        )}

        {step === 'action-hub' && profile && analysis && (
          <ActionHubView
            originalProfile={profile}
            initialReview={review || undefined}
            analysis={analysis}
            onStartNew={handleResetSession}
            aiProvider={getActiveProvider()}
            onUpdateAnalysis={setAnalysis}
          />
        )}
      </main>

      {/* Global Modals */}
      <OnboardingModal
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        onStartDemo={handleLoadDemo}
        onOpenApiKey={() => setApiKeyDialogOpen(true)}
      />

      <ApiKeyDialog
        open={apiKeyDialogOpen}
        onOpenChange={setApiKeyDialogOpen}
        apiKey={apiKey}
        providerId={providerId}
        model={model}
        onSave={handleSaveApiKey}
        onClear={handleClearApiKey}
      />

      <McpHubModal
        isOpen={mcpHubOpen}
        onClose={() => setMcpHubOpen(false)}
      />
    </div>
  );
}

export default App;
