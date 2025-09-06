import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getReportButtonsForBooth, submitReport, validateCheckin } from '../services/api';
import { ReportButtonConfig, ReportType } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Input from '../components/Input';

const InformesPage: React.FC = () => {
  const { boothCode } = useParams<{ boothCode: string }>();
  const navigate = useNavigate();
  
  const [checkinInfo, setCheckinInfo] = useState<{staffName: string, eventId: string, personalCode: string, departmentId?: string, companyName: string} | null>(null);
  const [allButtons, setAllButtons] = useState<ReportButtonConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for report submission modal
  const [selectedButton, setSelectedButton] = useState<ReportButtonConfig | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [primaryResponse, setPrimaryResponse] = useState('');
  const [followUpResponse, setFollowUpResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean | null>(null);

  // State for booth switching modal
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [newBoothCode, setNewBoothCode] = useState('');
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState('');


  useEffect(() => {
    const checkinInfoRaw = sessionStorage.getItem('checkinInfo');
    if (checkinInfoRaw) {
      try {
        const info = JSON.parse(checkinInfoRaw);
        setCheckinInfo({
            staffName: info.staffName || '',
            eventId: info.eventId || '',
            personalCode: info.personalCode || '',
            departmentId: info.departmentId,
            companyName: info.companyName || ''
        });
      } catch (e) {
        console.error("Failed to parse checkinInfo from sessionStorage", e);
        navigate('/');
      }
    } else {
        navigate('/');
    }

    const fetchButtons = async () => {
      if (!boothCode) return;
      try {
        setLoading(true);
        const fetchedButtons = await getReportButtonsForBooth(boothCode);
        setAllButtons(fetchedButtons);
      } catch (err) {
        setError('Falha ao carregar as ações.');
      } finally {
        setLoading(false);
      }
    };
    fetchButtons();
  }, [boothCode, navigate]);

  const visibleButtons = useMemo(() => {
    if (!checkinInfo) return [];
    // Show buttons for the staff's department OR buttons with no department (general)
    return allButtons.filter(button => !button.departmentId || button.departmentId === checkinInfo.departmentId);
  }, [allButtons, checkinInfo]);

  const handleButtonClick = (button: ReportButtonConfig) => {
    setSelectedButton(button);
    setPrimaryResponse('');
    setFollowUpResponse('');
    setSubmissionSuccess(null);
    setIsReportModalOpen(true);
  };

  const handleModalClose = useCallback(() => {
    setIsReportModalOpen(false);
    setSelectedButton(null);
  }, []);
  
  const handleExit = () => {
    sessionStorage.removeItem('checkinInfo');
    navigate('/');
  }

  const handleSwitchBooth = async () => {
    if (!newBoothCode || !checkinInfo?.personalCode) {
        setSwitchError('Por favor, insira o código do estande.');
        return;
    }
    setSwitching(true);
    setSwitchError('');
    try {
        const { staff, event, company } = await validateCheckin(newBoothCode, checkinInfo.personalCode);
        sessionStorage.setItem('checkinInfo', JSON.stringify({
            boothCode: newBoothCode.toUpperCase(),
            companyName: company.name,
            personalCode: checkinInfo.personalCode,
            staffName: staff.name,
            eventId: event.id,
            departmentId: staff.departmentId,
        }));
        setIsSwitchModalOpen(false);
        setNewBoothCode('');
        navigate(`/informes/${newBoothCode.toUpperCase()}`);
    } catch (err) {
        setSwitchError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
    } finally {
        setSwitching(false);
    }
  };


  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedButton || !boothCode || !checkinInfo) return;
    
    setSubmitting(true);
    setSubmissionSuccess(null);

    let finalResponse = primaryResponse;
    if (
      selectedButton.type === ReportType.YES_NO && 
      selectedButton.followUp &&
      primaryResponse === selectedButton.followUp.triggerValue &&
      followUpResponse
    ) {
      finalResponse = `${primaryResponse} - ${selectedButton.followUp.question}: ${followUpResponse}`;
    }

    try {
      await submitReport({
        eventId: checkinInfo.eventId,
        boothCode,
        staffName: checkinInfo.staffName,
        reportLabel: selectedButton.label,
        response: finalResponse,
      });
      setSubmissionSuccess(true);
      setTimeout(() => {
        handleModalClose();
      }, 1500);
    } catch (err) {
      setSubmissionSuccess(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <p className="text-red-500 text-center">{error}</p>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 p-4 bg-card rounded-lg shadow">
          <div>
            <h2 className="text-2xl font-bold text-center sm:text-left">
              Estande: <span className="text-primary">{checkinInfo?.companyName || boothCode}</span>
            </h2>
            <p className="text-sm text-text-secondary text-center sm:text-left">Código: {boothCode}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsSwitchModalOpen(true)}>
                Trocar Estande
            </Button>
            <Button variant="danger" onClick={handleExit}>Sair</Button>
          </div>
      </div>
      <h3 className="text-xl mb-4 text-center">Ações Disponíveis</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {visibleButtons.map((button) => (
          <button
            key={button.id}
            onClick={() => handleButtonClick(button)}
            className="p-6 bg-card rounded-lg shadow-lg text-center transition-transform transform hover:-translate-y-1 hover:shadow-xl"
          >
            <span className="text-xl font-semibold">{button.label}</span>
          </button>
        ))}
      </div>

      {/* Report Submission Modal */}
      {selectedButton && (
        <Modal isOpen={isReportModalOpen} onClose={handleModalClose} title={selectedButton.label}>
          {submissionSuccess === true ? (
             <div className="text-center p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-4 text-lg font-semibold">Informe enviado com sucesso!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmitReport}>
              <p className="mb-4 text-lg">{selectedButton.question}</p>
              
              {selectedButton.type === ReportType.OPEN_TEXT && (
                <textarea
                  value={primaryResponse}
                  onChange={(e) => setPrimaryResponse(e.target.value)}
                  className="w-full p-2 border border-border rounded-md bg-background"
                  rows={4}
                  required
                />
              )}

              {selectedButton.type === ReportType.MULTIPLE_CHOICE && selectedButton.options && (
                <div className="space-y-2">
                  {selectedButton.options.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-border cursor-pointer">
                      <input
                        type="radio"
                        name="report-option"
                        value={option.label}
                        checked={primaryResponse === option.label}
                        onChange={(e) => setPrimaryResponse(e.target.value)}
                        required
                        className="form-radio text-primary focus:ring-primary"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              )}

              {selectedButton.type === ReportType.YES_NO && (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    {['Sim', 'Não'].map(option => (
                        <label key={option} className="flex-1 flex items-center justify-center gap-2 p-3 rounded-md border-2 border-border hover:bg-border cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-black has-[:checked]:border-primary">
                          <input
                            type="radio"
                            name="yes-no-option"
                            value={option}
                            checked={primaryResponse === option}
                            onChange={(e) => setPrimaryResponse(e.target.value)}
                            required
                            className="sr-only"
                          />
                          <span className="font-semibold">{option}</span>
                        </label>
                    ))}
                  </div>

                  {selectedButton.followUp && primaryResponse === selectedButton.followUp.triggerValue && (
                    <div className="border-t border-border pt-4 animate-fade-in">
                        <label className="block text-sm font-medium mb-2" htmlFor="followUpInput">
                            {selectedButton.followUp.question}
                        </label>
                        {selectedButton.followUp.type === ReportType.MULTIPLE_CHOICE && selectedButton.followUp.options ? (
                           <div className="space-y-2">
                            {selectedButton.followUp.options.map((option) => (
                              <label key={option.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-border cursor-pointer">
                                <input
                                  type="radio"
                                  name="follow-up-option"
                                  value={option.label}
                                  checked={followUpResponse === option.label}
                                  onChange={(e) => setFollowUpResponse(e.target.value)}
                                  required
                                  className="form-radio text-primary focus:ring-primary"
                                />
                                <span>{option.label}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <textarea
                              id="followUpInput"
                              value={followUpResponse}
                              onChange={(e) => setFollowUpResponse(e.target.value)}
                              className="w-full p-2 border border-border rounded-md bg-background"
                              rows={2}
                              required
                          />
                        )}
                    </div>
                  )}
                </div>
              )}

              {submissionSuccess === false && <p className="text-red-500 mt-2 text-center">Falha ao enviar o informe.</p>}
              <div className="mt-6 flex justify-end gap-4">
                <Button type="button" variant="secondary" onClick={handleModalClose}>Cancelar</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <LoadingSpinner /> : 'Enviar'}
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Switch Booth Modal */}
      <Modal isOpen={isSwitchModalOpen} onClose={() => setIsSwitchModalOpen(false)} title="Trocar de Estande">
        <div className="space-y-4">
          <p>Você está logado como <span className="font-bold">{checkinInfo?.staffName}</span> (Cód: {checkinInfo?.personalCode}).</p>
          <Input 
            id="new-booth-code"
            label="Código do Novo Estande"
            value={newBoothCode}
            onChange={e => setNewBoothCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
            placeholder="Digite o código do estande"
            autoFocus
          />
          {switchError && <p className="text-red-500 text-sm">{switchError}</p>}
          <div className="flex justify-end gap-4 pt-2">
            <Button variant="secondary" onClick={() => setIsSwitchModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSwitchBooth} disabled={switching}>
                {switching ? <LoadingSpinner /> : 'Validar'}
            </Button>
          </div>
        </div>
      </Modal>

      <style>{`
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default InformesPage;