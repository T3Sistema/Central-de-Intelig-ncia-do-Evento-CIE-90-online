
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getStaffByOrganizer, getStaffActivity, getParticipantCompaniesByEvent, getReportsByEvent, getEvents, getOrganizerCompanyById } from '../../services/api';
import { Staff, StaffActivity, ParticipantCompany, ReportSubmission, Event, OrganizerCompany } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import Input from '../Input';

// Tell TypeScript that jspdf is loaded globally from the CDN
declare const jspdf: any;

interface Props {
  eventId: string;
}

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const DashboardView: React.FC<Props> = ({ eventId }) => {
  const [event, setEvent] = useState<Event | null>(null);
  const [organizer, setOrganizer] = useState<OrganizerCompany | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [companies, setCompanies] = useState<ParticipantCompany[]>([]);
  const [reports, setReports] = useState<ReportSubmission[]>([]);
  const [activities, setActivities] = useState<Record<string, StaffActivity[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'staff' | 'company'>('staff');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const allEvents = await getEvents();
      const currentEvent = allEvents.find(e => e.id === eventId);
      setEvent(currentEvent || null);

      if (currentEvent) {
        const organizerData = await getOrganizerCompanyById(currentEvent.organizerCompanyId);
        setOrganizer(organizerData);

        const [staffData, companiesData, reportsData] = await Promise.all([
          getStaffByOrganizer(currentEvent.organizerCompanyId),
          getParticipantCompaniesByEvent(eventId),
          getReportsByEvent(eventId),
        ]);

        setStaff(staffData);
        setCompanies(companiesData);
        setReports(reportsData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));

        if (staffData.length > 0) {
          const activityPromises = staffData.map(s => getStaffActivity(s.id));
          const activitiesData = await Promise.all(activityPromises);
          const activitiesMap: Record<string, StaffActivity[]> = {};
          staffData.forEach((s, index) => {
            activitiesMap[s.id] = activitiesData[index];
          });
          setActivities(activitiesMap);
        }
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  

  const handleDownloadStaffReport = (member: Staff) => {
    const doc = new jspdf.jsPDF();
    const memberActivities = activities[member.id] || [];
    
    doc.setFontSize(18);
    doc.text(`Relatório de Atividades: ${member.name}`, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Evento: ${event?.name || 'N/A'}`, 14, 30);
    
    const tableColumn = ["Descrição", "Data/Hora"];
    const tableRows: string[][] = [];

    memberActivities.forEach(activity => {
      const activityData = [
        activity.description,
        new Date(activity.timestamp).toLocaleString('pt-BR'),
      ];
      tableRows.push(activityData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
    });
    
    doc.save(`relatorio_equipe_${member.personalCode}.pdf`);
  };

  const handleDownloadCompanyReport = (company: ParticipantCompany) => {
    const doc = new jspdf.jsPDF();
    const companyReports = reports.filter(r => r.boothCode === company.boothCode);
    
    doc.setFontSize(18);
    doc.text(`Relatório de Registros: ${company.name}`, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Evento: ${event?.name || 'N/A'}`, 14, 30);
    
    const tableColumn = ["Ação", "Resposta", "Equipe", "Data/Hora"];
    const tableRows: string[][] = [];

    companyReports.forEach(report => {
        const reportData = [
            report.reportLabel,
            `"${report.response}"`,
            report.staffName,
            new Date(report.timestamp).toLocaleString('pt-BR'),
        ];
        tableRows.push(reportData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
    });

    doc.save(`relatorio_empresa_${company.boothCode}.pdf`);
  };

  const filteredStaff = useMemo(() =>
    staff.filter(s =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.personalCode.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [staff, searchTerm]
  );
  
  const filteredCompanies = useMemo(() =>
    companies.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.boothCode.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [companies, searchTerm]
  );

  const getButtonClass = (mode: 'staff' | 'company') => {
    const base = 'px-4 py-2 rounded-lg font-semibold transition-colors duration-300 w-1/2 sm:w-auto';
    if (viewMode === mode) {
      return `${base} bg-primary text-black`;
    }
    return `${base} bg-card hover:bg-secondary-hover`;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
            <h2 className="hidden md:block text-3xl font-bold">Dashboard de Atividades</h2>
            <p className="text-text-secondary">{event?.name}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
            <div className="p-1 bg-secondary rounded-lg flex-shrink-0 flex">
                <button onClick={() => setViewMode('staff')} className={getButtonClass('staff')}>
                    Por Equipe
                </button>
                <button onClick={() => setViewMode('company')} className={getButtonClass('company')}>
                    Por Empresa
                </button>
            </div>
          <Input
            id="search-dashboard"
            label=""
            placeholder={viewMode === 'staff' ? 'Buscar membro...' : 'Buscar empresa...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 mb-0 flex-grow"
          />
        </div>
      </div>
      
      {viewMode === 'staff' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStaff.map(member => (
            <div key={member.id} className="bg-card p-5 rounded-lg shadow-md">
              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-4 overflow-hidden">
                    <img src={member.photoUrl || 'https://via.placeholder.com/150'} alt={member.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
                    <div className="truncate">
                        <h3 className="text-lg font-bold truncate">{member.name}</h3>
                        <p className="text-sm text-text-secondary">Cód: {member.personalCode}</p>
                    </div>
                 </div>
                 <button onClick={() => handleDownloadStaffReport(member)} className="p-2 rounded-full hover:bg-border transition-colors flex-shrink-0" title="Baixar Relatório em PDF">
                    <DownloadIcon />
                 </button>
              </div>
              <div className="border-t border-border pt-3">
                <h4 className="font-semibold mb-2">Registros Recentes</h4>
                <ul className="space-y-2 text-sm max-h-40 overflow-y-auto">
                  {activities[member.id]?.length > 0 ? (
                    activities[member.id].map(activity => (
                      <li key={activity.id} className="flex justify-between items-baseline">
                        <span className="pr-2">{activity.description}</span>
                        <span className="text-xs text-text-secondary flex-shrink-0">{new Date(activity.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-text-secondary">Nenhuma atividade registrada.</li>
                  )}
                </ul>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompanies.map(company => {
            const companyReports = reports.filter(r => r.boothCode === company.boothCode);
            return (
              <div key={company.id} className="bg-card p-5 rounded-lg shadow-md flex flex-col">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-primary">{company.name}</h3>
                    <p className="text-sm text-text-secondary">Cód. Estande: {company.boothCode}</p>
                  </div>
                  <button onClick={() => handleDownloadCompanyReport(company)} className="p-2 rounded-full hover:bg-border transition-colors flex-shrink-0" title="Baixar Relatório em PDF">
                    <DownloadIcon />
                  </button>
                </div>
                <div className="border-t border-border pt-3 mt-3 flex-grow">
                  <h4 className="font-semibold mb-2">Registros Recentes</h4>
                  <ul className="space-y-3 text-sm max-h-64 overflow-y-auto pr-2">
                    {companyReports.length > 0 ? (
                      companyReports.map(report => (
                        <li key={report.id} className="border-b border-border/50 pb-2 last:border-b-0">
                          <div className="flex justify-between items-start">
                            <span className="font-semibold pr-2">{report.reportLabel}</span>
                            <span className="text-xs text-text-secondary flex-shrink-0">{new Date(report.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-text mt-1">
                            <span className="font-medium">{report.staffName}:</span> "{report.response}"
                          </p>
                        </li>
                      ))
                    ) : (
                      <li className="text-text-secondary">Nenhum registro para esta empresa.</li>
                    )}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DashboardView;