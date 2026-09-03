'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '@/core/auth/AuthProvider';
import { 
  LayoutDashboard, 
  HardHat, 
  Ruler,
  TrendingUp,
  Landmark,
  ShoppingBag,
  Users,
  Settings,
  BookOpen,
  Briefcase,
  Headset,
  Truck,
  Calculator,
  Receipt,
  ShieldCheck,
  Building,
  BarChart4,
  Map,
  ChevronDown,
  ChevronRight,
  UserCheck,
  X
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose = () => {} }: SidebarProps) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Principal': true,
    'Core Business': true
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  // Função para verificar acesso aos módulos
  const hasAccess = (allowedRoles: string[]) => {
    if (!profile) return false;
    // O cargo "god" e "admin" tem acesso total irrestrito a todos os módulos
    if (['god', 'admin'].includes(profile.role)) return true;
    return allowedRoles.includes(profile.role);
  };

  const menuGroups = [
    {
      title: 'Principal',
      items: [
        { 
          label: 'Visão Geral', 
          icon: LayoutDashboard, 
          roles: ['god', 'admin', 'engenheiro', 'financeiro'],
          subItems: [
            { label: 'Dashboard Central', href: '/', active: true }
          ]
        }
      ]
    },
    {
      title: 'Core Business',
      items: [
        { 
          label: 'Operacional (Projetos)', 
          icon: HardHat, 
          roles: ['god', 'admin', 'engenheiro'],
          subItems: [
            { label: 'Dashboard Operacional', href: '/operacional', active: true },
            { label: 'Projetos', href: '/projetos', active: true },
            { label: 'Relatório Fotográfico', href: '/engenharia/relatorio-fotografico', active: true },
            { label: 'Diário de Projeto', href: '#', active: false, badge: 'Breve' },
            { label: 'Medição Física', href: '#', active: false, badge: 'Breve' }
          ]
        },
        { 
          label: 'Engenharia (PCM)', 
          icon: Ruler, 
          roles: ['god', 'admin', 'engenheiro', 'convidado'],
          subItems: [
            { label: 'Dashboard PCM', href: '/engenharia', active: true },
            { label: 'Relatório Fotográfico', href: '/engenharia/relatorio-fotografico', active: true },
            { label: 'Orçamento do Projeto', href: '#', active: false, badge: 'Breve' },
            { label: 'Cronograma (EAP)', href: '#', active: false, badge: 'Breve' }
          ]
        },
        { 
          label: 'Comercial & Vendas', 
          icon: Briefcase, 
          roles: ['god', 'admin', 'comercial'],
          subItems: [
            { label: 'Dashboard Comercial', href: '/comercial', active: true },
            { label: 'Funil de Propostas', href: '#', active: false, badge: 'Breve' },
            { label: 'Licitações', href: '#', active: false, badge: 'Breve' }
          ]
        },
        { 
          label: 'CRM & Pós-venda', 
          icon: Headset, 
          roles: ['god', 'admin', 'comercial'],
          subItems: [
            { label: 'Painel de Clientes', href: '/crm', active: true },
            { label: 'Histórico e Contatos', href: '#', active: false, badge: 'Breve' },
            { label: 'Assistência Técnica', href: '#', active: false, badge: 'Breve' }
          ]
        }
      ]
    },
    {
      title: 'Backoffice',
      items: [
        { 
          label: 'Suprimentos & Compras', 
          icon: ShoppingBag, 
          roles: ['god', 'admin', 'engenheiro', 'financeiro'],
          subItems: [
            { label: 'Dashboard Suprimentos', href: '/suprimentos', active: true },
            { label: 'Pedidos de Compra', href: '#', active: false, badge: 'Breve' },
            { label: 'Estoque / Almoxarifado', href: '#', active: false, badge: 'Breve' }
          ]
        },
        { 
          label: 'Frota & Patrimônio', 
          icon: Truck, 
          roles: ['god', 'admin', 'engenheiro'],
          subItems: [
            { label: 'Gestão de Patrimônio', href: '/patrimonio', active: true },
            { label: 'Máquinas e Veículos', href: '#', active: false, badge: 'Breve' },
            { label: 'Manutenções', href: '#', active: false, badge: 'Breve' }
          ]
        },
        { 
          label: 'Financeiro', 
          icon: Landmark, 
          roles: ['god', 'admin', 'financeiro'],
          subItems: [
            { label: 'Dashboard Financeiro', href: '/financeiro', active: true },
            { label: 'Lançar Custo Efetivo', href: '/custos', active: true },
            { label: 'Lançar Recebimento', href: '/recebimentos', active: true },
            { label: 'Fluxo de Caixa', href: '#', active: false, badge: 'Breve' },
            { label: 'Contas a Pagar', href: '#', active: false, badge: 'Breve' }
          ]
        },
        { 
          label: 'Contábil', 
          icon: Calculator, 
          roles: ['god', 'admin', 'financeiro'],
          subItems: [
            { label: 'Dashboard Contábil', href: '/contabil', active: true },
            { label: 'Plano de Contas', href: '#', active: false, badge: 'Breve' },
            { label: 'Balanço / DRE', href: '#', active: false, badge: 'Breve' }
          ]
        },
        { 
          label: 'Fiscal / Tributário', 
          icon: Receipt, 
          roles: ['god', 'admin', 'financeiro'],
          subItems: [
            { label: 'Dashboard Fiscal', href: '/fiscal', active: true },
            { label: 'Apuração Impostos', href: '#', active: false, badge: 'Breve' },
            { label: 'Notas Fiscais', href: '#', active: false, badge: 'Breve' }
          ]
        },
        { 
          label: 'Recursos Humanos', 
          icon: Users, 
          roles: ['god', 'admin', 'rh'],
          subItems: [
            { label: 'Dashboard RH', href: '/rh', active: true },
            { label: 'Parceiros', href: '/rh/parceiros', active: true },
            { label: 'Lançar Diárias', href: '/rh/pagamentos-parceiros', active: true },
            { label: 'Colaboradores', href: '#', active: false, badge: 'Breve' },
            { label: 'Folha de Pagamento', href: '#', active: false, badge: 'Breve' }
          ]
        },
        { 
          label: 'Qualidade (QSMS)', 
          icon: ShieldCheck, 
          roles: ['god', 'admin', 'engenheiro'],
          subItems: [
            { label: 'Painel QSMS', href: '/qsms', active: true },
            { label: 'Controle de EPIs', href: '#', active: false, badge: 'Breve' },
            { label: 'Segurança e Riscos', href: '#', active: false, badge: 'Breve' }
          ]
        },
        { 
          label: 'Jurídico', 
          icon: BookOpen, 
          roles: ['god', 'admin', 'juridico'],
          subItems: [
            { label: 'Painel Jurídico', href: '/juridico', active: true },
            { label: 'Contratos e Aditivos', href: '#', active: false, badge: 'Breve' },
            { label: 'Certidões / Compliance', href: '#', active: false, badge: 'Breve' }
          ]
        },
        { 
          label: 'Administrativo', 
          icon: Building, 
          roles: ['god', 'admin', 'financeiro', 'rh'],
          subItems: [
            { label: 'Painel Administrativo', href: '/administrativo', active: true },
            { label: 'Viagens e Despesas', href: '#', active: false, badge: 'Breve' },
            { label: 'Facilities', href: '#', active: false, badge: 'Breve' }
          ]
        }
      ]
    },
    {
      title: 'Estratégico',
      items: [
        { 
          label: 'Controladoria (BI)', 
          icon: BarChart4, 
          roles: ['god', 'admin', 'diretoria'],
          subItems: [
            { label: 'Painel Consolidado BI', href: '/controladoria', active: true },
            { label: 'Relatórios Gerenciais', href: '/relatorios', active: true },
            { label: 'Margem por Projeto', href: '#', active: false, badge: 'Breve' }
          ]
        },
        { 
          label: 'Incorporação', 
          icon: Map, 
          roles: ['god', 'admin', 'diretoria'],
          subItems: [
            { label: 'Dashboard Empreend.', href: '/incorporacao', active: true },
            { label: 'Viabilidade Terrenos', href: '#', active: false, badge: 'Breve' },
            { label: 'Repasse Bancário', href: '#', active: false, badge: 'Breve' }
          ]
        }
      ]
    },
    {
      title: 'Sistema',
      items: [
        { 
          label: 'Configurações', 
          icon: Settings, 
          roles: ['god', 'admin'],
          subItems: [
            { label: 'Painel de Configurações', href: '/configuracoes', active: true },
            { label: 'Gestão de Usuários', href: '/configuracoes/usuarios', active: true },
            { label: 'Perfis e Acessos', href: '#', active: false, badge: 'Breve' }
          ]
        }
      ]
    }
  ];

  const getLogoSrc = () => {
    if (!mounted) return '/brand/LogoVbranco.png';
    return theme === 'light' ? '/brand/LogoVpreto.png' : '/brand/LogoVbranco.png';
  };

  return (
    <>
      {/* Overlay para Mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      <aside className={`fixed md:relative inset-y-0 left-0 z-50 w-[280px] bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      
      {/* Bloco Superior: Logo */}
      <div className="h-32 flex flex-col justify-center items-center py-2 px-4 border-b border-card-border bg-slate-500/5 dark:bg-white/[0.01] shrink-0">
        {mounted && !logoError ? (
          <div className="relative h-28 w-full flex items-center justify-center">
            <img 
              src={getLogoSrc()} 
              alt="Aprimore Construtora" 
              className="h-24 w-auto object-contain transition-all duration-200"
              onError={() => setLogoError(true)}
            />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="bg-brand-blue/10 dark:bg-brand-ocre/10 p-2.5 rounded-xl text-brand-blue dark:text-brand-ocre flex items-center justify-center border border-brand-blue/10 dark:border-brand-ocre/20">
              <HardHat size={20} />
            </div>
            <div className="text-center">
              <h1 className="font-extrabold text-sm tracking-wider text-main uppercase">APRIMORE</h1>
              <p className="text-[8px] text-brand-ocre font-bold tracking-widest uppercase">ENGENHARIA & ARQ</p>
            </div>
          </div>
        )}
      </div>

      {/* Links de Navegação Agrupados com Rolagem Suave */}
      <nav className="flex-1 overflow-y-auto py-5 px-4 space-y-5 scrollbar-thin scrollbar-thumb-card-border scrollbar-track-transparent">
        {menuGroups.map((group) => {
          // Filtra os módulos que o usuário tem acesso
          const groupItems = group.items.filter(item => hasAccess(item.roles));
          
          if (groupItems.length === 0) return null;
          const isExpanded = expandedGroups[group.title] !== false;

          return (
            <div key={group.title} className="space-y-2">
              
              {/* Cabeçalho da Categoria (Acordeão) */}
              <button 
                onClick={() => toggleGroup(group.title)}
                className="w-full flex items-center justify-between py-1.5 text-[10px] font-black tracking-wider text-brand-ocre uppercase hover:text-brand-blue dark:hover:text-white transition-colors"
              >
                <span>{group.title}</span>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {/* Módulos e suas Telas */}
              {isExpanded && (
                <div className="space-y-4 mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  {groupItems.map((module) => {
                    const ModuleIcon = module.icon;
                    return (
                      <div key={module.label} className="space-y-1.5">
                        {/* Título do Módulo */}
                        <div className="flex items-center gap-2 text-[11px] font-extrabold text-main uppercase tracking-wide px-1 opacity-80">
                          <ModuleIcon size={14} className="text-brand-blue dark:text-brand-ocre shrink-0" />
                          <span>{module.label}</span>
                        </div>

                        {/* Telas (Páginas) do Módulo */}
                        <div className="flex flex-col gap-0.5 relative before:absolute before:left-[6px] before:top-2 before:bottom-2 before:w-px before:bg-card-border ml-1">
                          {module.subItems.map((screen) => {
                            const isActive = screen.active && (pathname === screen.href || (screen.href !== '/' && pathname.startsWith(screen.href)));

                            if (screen.active) {
                              return (
                                <Link
                                  key={screen.label}
                                  href={screen.href}
                                  onClick={onClose}
                                  className={`pl-5 pr-2 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
                                    isActive 
                                      ? 'bg-brand-blue/10 dark:bg-white/[0.06] text-brand-blue dark:text-brand-ocre' 
                                      : 'text-sub hover:text-brand-blue dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.03]'
                                  }`}
                                >
                                  {isActive && (
                                    <span className="absolute left-[-1px] top-1/2 -translate-y-1/2 w-0.5 h-3 bg-brand-blue dark:bg-brand-ocre rounded-full"></span>
                                  )}
                                  <span>{screen.label}</span>
                                </Link>
                              );
                            }

                            return (
                              <div
                                key={screen.label}
                                className="pl-5 pr-2 py-1.5 rounded-lg text-xs font-semibold text-slate-400 dark:text-slate-500 flex justify-between items-center cursor-not-allowed group"
                              >
                                <span>{screen.label}</span>
                                <span className="text-[8px] font-black tracking-widest text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700/50 px-1.5 py-0.5 rounded uppercase">
                                  {screen.badge}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer da Sidebar */}
      <div className="p-4 border-t border-card-border shrink-0 bg-background/50">
        <div className="flex items-center gap-3 px-2 py-1 text-slate-500 text-[10px] font-semibold">
          <Settings size={12} />
          <span>APRIMORE ERP V2.0 Modular</span>
        </div>
      </div>
    </aside>
    </>
  );
}
