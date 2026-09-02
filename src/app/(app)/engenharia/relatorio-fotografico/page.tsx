'use client';

import { useEffect, useState } from 'react';
import { Building2, Check, Loader2, Ruler } from 'lucide-react';
import { useAuth } from '@/core/auth/AuthProvider';
import {
  atualizarCamposProjeto,
  atualizarEquipamentos,
  atualizarEstrutura,
  buscarProjetos,
  criarEstrutura,
  desabilitarServico,
  habilitarServico,
  lerServicosGlobais,
  obterEstruturaPorProjeto,
} from '@/modules/engenharia/relatorio-fotografico/services/apiRelatorioFotografico';
import { limpaNome, pad } from '@/modules/engenharia/relatorio-fotografico/calc';
import type {
  Equipamento,
  EstruturaFotografica,
  ProjetoResumo,
  TipoProjetoFotografico,
} from '@/modules/engenharia/relatorio-fotografico/types';

function ajustaPontos(pontos: { numero: string; local: string }[], qtd: number) {
  qtd = Math.max(0, Math.min(999, qtd | 0));
  const novo = pontos.slice(0, qtd);
  while (novo.length < qtd) novo.push({ numero: pad(novo.length + 1), local: '' });
  return novo;
}

export default function RelatorioFotograficoPage() {
  const { user } = useAuth();

  // passo 1 — vínculo com projeto (ou avulso)
  const [isAvulso, setIsAvulso] = useState(false);
  const [obraNome, setObraNome] = useState('');
  const [projetoBusca, setProjetoBusca] = useState('');
  const [projetosSugeridos, setProjetosSugeridos] = useState<ProjetoResumo[]>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [projetoSelecionado, setProjetoSelecionado] = useState<ProjetoResumo | null>(null);
  const [buscandoProjetos, setBuscandoProjetos] = useState(false);

  // passo 2 — tipo
  const [tipoProjeto, setTipoProjeto] = useState<TipoProjetoFotografico>('infraestrutura');

  // passo 3 — dados de cabeçalho (slides 1 e 2)
  const [banco, setBanco] = useState('');
  const [modeloRelatorio, setModeloRelatorio] = useState('');
  const [agencia, setAgencia] = useState('');
  const [programa, setPrograma] = useState('');
  const [upe, setUpe] = useState('');
  const [sap, setSap] = useState('');
  const [gestor, setGestor] = useState('');
  const [fiscEmpresa, setFiscEmpresa] = useState('');
  const [fiscal, setFiscal] = useState('');
  const [construtora, setConstrutora] = useState('');
  const [responsavel, setResponsavel] = useState('');

  const [estrutura, setEstrutura] = useState<EstruturaFotografica | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // passo 4 — equipamentos (infra) / serviços (reforma)
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [servicosGlobais, setServicosGlobais] = useState<string[]>([]);
  const [novoServico, setNovoServico] = useState('');
  const [servicoOcupado, setServicoOcupado] = useState<string | null>(null);

  useEffect(() => {
    lerServicosGlobais().then(setServicosGlobais).catch(() => {});
  }, []);

  // autocomplete de projeto — mesmo padrão do FormProjeto (busca + dropdown)
  useEffect(() => {
    if (isAvulso || !projetoBusca.trim()) {
      setProjetosSugeridos([]);
      return;
    }
    const t = setTimeout(async () => {
      setBuscandoProjetos(true);
      try {
        setProjetosSugeridos(await buscarProjetos(projetoBusca));
      } catch (e) {
        console.error(e);
      } finally {
        setBuscandoProjetos(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [projetoBusca, isAvulso]);

  async function selecionarProjeto(p: ProjetoResumo) {
    setProjetoSelecionado(p);
    setProjetoBusca(p.nome);
    setMostrarSugestoes(false);
    setBanco(p.cliente_final_nome || '');
    setPrograma(p.tipologia || '');
    // dados de obra vêm do projeto (migration 00010) — fonte única, não duplicada no relatório
    setAgencia(p.agencia || '');
    setUpe(p.upe || '');
    setSap(p.sap || '');
    setGestor(p.gestor || '');
    setFiscEmpresa(p.fiscalizacao_empresa || '');
    setFiscal(p.fiscal || '');
    setConstrutora(p.construtora || '');
    setResponsavel(p.responsavel || '');

    const existente = await obterEstruturaPorProjeto(p.id).catch(() => null);
    if (existente) {
      carregarEstruturaNoFormulario(existente);
    }
  }

  function carregarEstruturaNoFormulario(e: EstruturaFotografica) {
    setEstrutura(e);
    setTipoProjeto(e.tipo_projeto);
    setBanco(e.banco || '');
    setModeloRelatorio(e.modelo_relatorio || '');
    setPrograma(e.programa || '');
    // agência/UPE/SAP/gestor/fiscalização/construtora/responsável: quando vinculado a
    // projeto, essa informação vive em `projetos` (migration 00010) e já foi
    // preenchida por selecionarProjeto() — aqui só sobrescreve no caso avulso,
    // onde a própria engenharia_estrutura_fotografica é a fonte (migration 00009).
    if (e.is_avulso) {
      setAgencia(e.agencia || '');
      setUpe(e.upe || '');
      setSap(e.sap || '');
      setGestor(e.gestor || '');
      setFiscEmpresa(e.fiscalizacao_empresa || '');
      setFiscal(e.fiscal || '');
      setConstrutora(e.construtora || '');
      setResponsavel(e.responsavel || '');
    }
    setEquipamentos(e.equipamentos || []);
  }

  const podeCriar = isAvulso ? obraNome.trim().length > 0 : !!projetoSelecionado;

  /**
   * Dados de obra (agência/UPE/SAP/gestor/fiscalização/construtora/
   * responsável): quando vinculado a projeto, moram em `projetos`
   * (migration 00010) — fonte única, útil pra empresa toda, não só o
   * relatório. Só ficam em `engenharia_estrutura_fotografica` (migration
   * 00009) quando avulso, já que aí não existe uma linha de `projetos`
   * pra guardar isso.
   */
  async function criarOuAtualizarCabecalho() {
    setSalvando(true);
    setErro(null);
    try {
      const camposObra = isAvulso
        ? { agencia: agencia || null, upe: upe || null, sap: sap || null, gestor: gestor || null, fiscalizacao_empresa: fiscEmpresa || null, fiscal: fiscal || null, construtora: construtora || null, responsavel: responsavel || null }
        : { agencia: null, upe: null, sap: null, gestor: null, fiscalizacao_empresa: null, fiscal: null, construtora: null, responsavel: null };

      if (!estrutura) {
        const nova = await criarEstrutura({
          projetoId: isAvulso ? null : projetoSelecionado!.id,
          userId: user?.id ?? null,
          isAvulso,
          obraNome: isAvulso ? limpaNome(obraNome) : null,
          tipoProjeto,
          banco: banco || null,
          modeloRelatorio: modeloRelatorio || null,
          programa: programa || null,
          ...camposObra,
        });
        setEstrutura(nova);
        if (!isAvulso) {
          await atualizarCamposProjeto(projetoSelecionado!.id, {
            agencia: agencia || null,
            upe: upe || null,
            sap: sap || null,
            gestor: gestor || null,
            fiscalizacao_empresa: fiscEmpresa || null,
            fiscal: fiscal || null,
            construtora: construtora || null,
            responsavel: responsavel || null,
          });
        }
        return nova;
      }

      const atualizada = await atualizarEstrutura(estrutura.id, {
        tipo_projeto: tipoProjeto,
        banco: banco || null,
        modelo_relatorio: modeloRelatorio || null,
        programa: programa || null,
        ...camposObra,
      });
      setEstrutura(atualizada);
      if (!isAvulso && projetoSelecionado) {
        await atualizarCamposProjeto(projetoSelecionado.id, {
          agencia: agencia || null,
          upe: upe || null,
          sap: sap || null,
          gestor: gestor || null,
          fiscalizacao_empresa: fiscEmpresa || null,
          fiscal: fiscal || null,
          construtora: construtora || null,
          responsavel: responsavel || null,
        });
      }
      return atualizada;
    } catch (e) {
      setErro((e as Error).message);
      return null;
    } finally {
      setSalvando(false);
    }
  }

  async function habilitarServicoAqui(nome: string) {
    let alvo = estrutura;
    if (!alvo) alvo = await criarOuAtualizarCabecalho();
    if (!alvo) return;
    setServicoOcupado(nome);
    try {
      const atualizada = await habilitarServico(alvo.id, nome);
      setEstrutura(atualizada);
      if (!servicosGlobais.includes(nome.trim().toUpperCase())) {
        setServicosGlobais(await lerServicosGlobais());
      }
      setNovoServico('');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setServicoOcupado(null);
    }
  }

  async function desabilitarServicoAqui(nome: string) {
    if (!estrutura) return;
    setServicoOcupado(nome);
    try {
      setEstrutura(await desabilitarServico(estrutura.id, nome));
    } finally {
      setServicoOcupado(null);
    }
  }

  async function salvarEquipamentos(novos: Equipamento[]) {
    setEquipamentos(novos);
    let alvo = estrutura;
    if (!alvo) alvo = await criarOuAtualizarCabecalho();
    if (!alvo) return;
    try {
      setEstrutura(await atualizarEquipamentos(alvo.id, novos));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const secao = 'bg-card border border-card-border rounded-xl p-4 space-y-4 shadow-sm';
  const tituloSecao =
    'text-xs font-bold text-brand-ocre flex items-center gap-2 border-b border-card-border pb-2 uppercase tracking-wider font-vomzom';
  const badge = (n: number) => (
    <span className="flex items-center justify-center h-5 w-5 rounded-md bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue font-black text-[10px]">
      {n}
    </span>
  );
  const label = 'text-[10px] font-bold text-desc uppercase tracking-wider text-brand-ocre';
  const input =
    'w-full px-3 py-2 bg-background border border-card-border rounded-lg text-xs text-main placeholder-slate-500 focus:outline-none focus:border-brand-ocre focus:ring-1 focus:ring-brand-ocre transition-all font-bold';

  return (
    <div className="space-y-6 pb-16">
      <div className="border-b border-card-border pb-5">
        <h2 className="text-2xl font-extrabold tracking-tight text-main capitalize font-vomzom">
          Relatório fotográfico
        </h2>
        <p className="text-sub text-sm mt-1">
          Estrutura a obra e monta o PowerPoint no padrão do banco, com fotos antes/depois numeradas.
        </p>
      </div>

      {erro && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold rounded-lg p-3">{erro}</div>
      )}

      {/* 1 — vínculo com projeto ou avulso */}
      <div className={secao}>
        <h3 className={tituloSecao}>
          {badge(1)} Projeto
        </h3>

        <label className="flex items-center gap-2 text-xs font-bold text-main">
          <input
            type="checkbox"
            checked={isAvulso}
            onChange={(e) => {
              setIsAvulso(e.target.checked);
              setEstrutura(null);
              setProjetoSelecionado(null);
            }}
          />
          Relatório avulso — obra que não é nossa (sem vínculo com projetos cadastrados)
        </label>

        {!isAvulso ? (
          <div className="space-y-1 relative">
            <label className={label}>Projeto / Obra *</label>
            <input
              type="text"
              value={projetoBusca}
              onChange={(e) => {
                setProjetoBusca(e.target.value);
                setProjetoSelecionado(null);
                setMostrarSugestoes(true);
              }}
              onFocus={() => setMostrarSugestoes(true)}
              onBlur={() => setTimeout(() => setMostrarSugestoes(false), 200)}
              className={input}
              placeholder="Busque pelo nome ou OS do projeto..."
            />
            {mostrarSugestoes && (buscandoProjetos || projetosSugeridos.length > 0) && (
              <div className="absolute z-50 w-full mt-1 bg-card border border-card-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {buscandoProjetos && <div className="px-3 py-2 text-xs text-sub">Buscando…</div>}
                {projetosSugeridos.map((p) => (
                  <div
                    key={p.id}
                    className="px-3 py-2 text-xs text-main hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer font-medium border-b border-card-border/50 last:border-0"
                    onClick={() => selecionarProjeto(p)}
                  >
                    <div className="font-bold">{p.nome}</div>
                    <div className="text-[10px] text-sub">
                      OS {p.os} {p.cliente_final_nome ? '· ' + p.cliente_final_nome : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <label className={label}>Nome da obra *</label>
            <input
              type="text"
              value={obraNome}
              onChange={(e) => setObraNome(e.target.value)}
              className={input}
              placeholder="ex.: Agência 8585 - Botafogo RJ"
            />
          </div>
        )}
      </div>

      {/* 2 — tipo de projeto */}
      <div className={secao}>
        <h3 className={tituloSecao}>{badge(2)} Tipo de projeto</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTipoProjeto('infraestrutura')}
            className={`text-left p-3 rounded-lg border ${tipoProjeto === 'infraestrutura' ? 'border-brand-ocre bg-brand-ocre/10' : 'border-card-border bg-background'}`}
          >
            <div className="flex items-center gap-2 font-bold text-xs text-main">
              <Ruler size={14} /> Infraestrutura
            </div>
            <p className="text-[10px] text-sub mt-1">Equipamento → pontos numerados. Um slide por ponto.</p>
          </button>
          <button
            type="button"
            onClick={() => setTipoProjeto('reforma')}
            className={`text-left p-3 rounded-lg border ${tipoProjeto === 'reforma' ? 'border-brand-ocre bg-brand-ocre/10' : 'border-card-border bg-background'}`}
          >
            <div className="flex items-center gap-2 font-bold text-xs text-main">
              <Building2 size={14} /> Reforma
            </div>
            <p className="text-[10px] text-sub mt-1">Serviço → antes, durante e depois. Várias fotos por etapa.</p>
          </button>
        </div>
      </div>

      {/* 3 — dados de cabeçalho */}
      <div className={secao}>
        <h3 className={tituloSecao}>{badge(3)} Dados do relatório</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className={label}>Banco / Cliente final</label>
            <input type="text" value={banco} onChange={(e) => setBanco(e.target.value)} className={input} placeholder="ex.: Itaú Personnalité" />
          </div>
          <div className="space-y-1">
            <label className={label}>Modelo de relatório</label>
            <input type="text" value={modeloRelatorio} onChange={(e) => setModeloRelatorio(e.target.value)} className={input} />
          </div>
          <div className="space-y-1">
            <label className={label}>Agência</label>
            <input type="text" value={agencia} onChange={(e) => setAgencia(e.target.value)} className={input} placeholder="ex.: 8647PERSONNALITE RJ-CAMPOS" />
          </div>
          <div className="space-y-1">
            <label className={label}>Programa</label>
            <input type="text" value={programa} onChange={(e) => setPrograma(e.target.value)} className={input} />
          </div>
          <div className="space-y-1">
            <label className={label}>Cód UPE</label>
            <input type="text" value={upe} onChange={(e) => setUpe(e.target.value)} className={input} />
          </div>
          <div className="space-y-1">
            <label className={label}>Cód SAP</label>
            <input type="text" value={sap} onChange={(e) => setSap(e.target.value)} className={input} />
          </div>
          <div className="space-y-1">
            <label className={label}>Gestor de obras</label>
            <input type="text" value={gestor} onChange={(e) => setGestor(e.target.value)} className={input} />
          </div>
          <div className="space-y-1">
            <label className={label}>Fiscalização — empresa</label>
            <input type="text" value={fiscEmpresa} onChange={(e) => setFiscEmpresa(e.target.value)} className={input} />
          </div>
          <div className="space-y-1">
            <label className={label}>Fiscal</label>
            <input type="text" value={fiscal} onChange={(e) => setFiscal(e.target.value)} className={input} />
          </div>
          <div className="space-y-1">
            <label className={label}>Construtora — empresa</label>
            <input type="text" value={construtora} onChange={(e) => setConstrutora(e.target.value)} className={input} placeholder="ex.: EGF CONSTRUTORA" />
          </div>
          <div className="space-y-1">
            <label className={label}>Responsável</label>
            <input type="text" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={input} />
          </div>
        </div>
        {projetoSelecionado && (
          <p className="text-[10px] text-sub">
            Início/término da obra vêm do projeto vinculado ({projetoSelecionado.data_prevista_inicio || '—'} a{' '}
            {projetoSelecionado.data_prevista_termino || '—'}) — não precisa cadastrar de novo aqui.
          </p>
        )}

        <button
          type="button"
          disabled={!podeCriar || salvando}
          onClick={criarOuAtualizarCabecalho}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-ocre text-white text-xs font-bold disabled:opacity-40"
        >
          {salvando ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
          {estrutura ? 'Salvar dados' : 'Iniciar relatório'}
        </button>
      </div>

      {/* 4 — serviços (reforma) */}
      {estrutura && tipoProjeto === 'reforma' && (
        <div className={secao}>
          <h3 className={tituloSecao}>{badge(4)} Serviços</h3>
          <p className="text-[10px] text-sub">
            Os nomes ficam guardados centralmente — marque os que valem para esta obra. Desmarcar não apaga nada, só
            tira da lista daqui.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {servicosGlobais.map((nome) => {
              const habilitado = estrutura.servicos_habilitados.includes(nome);
              return (
                <label
                  key={nome}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold ${habilitado ? 'border-brand-ocre bg-brand-ocre/10 text-main' : 'border-card-border bg-background text-sub'}`}
                  style={{ opacity: servicoOcupado === nome ? 0.6 : 1, cursor: servicoOcupado === nome ? 'wait' : 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={habilitado}
                    disabled={servicoOcupado === nome}
                    onChange={() => (habilitado ? desabilitarServicoAqui(nome) : habilitarServicoAqui(nome))}
                  />
                  {nome}
                </label>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={novoServico}
              onChange={(e) => setNovoServico(e.target.value.toUpperCase())}
              className={input}
              placeholder="Nome de um serviço novo"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && novoServico.trim()) habilitarServicoAqui(novoServico);
              }}
            />
            <button
              type="button"
              disabled={!novoServico.trim()}
              onClick={() => habilitarServicoAqui(novoServico)}
              className="px-3 py-2 rounded-lg border border-card-border text-xs font-bold text-main disabled:opacity-40"
            >
              + novo serviço
            </button>
          </div>
        </div>
      )}

      {/* 4 — equipamentos e pontos (infraestrutura) */}
      {estrutura && tipoProjeto === 'infraestrutura' && (
        <div className={secao}>
          <h3 className={tituloSecao}>{badge(4)} Equipamentos e pontos</h3>
          {equipamentos.map((eq, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={eq.nome}
                onChange={(e) =>
                  salvarEquipamentos(equipamentos.map((x, j) => (j === i ? { ...x, nome: e.target.value.toUpperCase() } : x)))
                }
                className={input}
                placeholder="ex.: Sensor de Presença"
              />
              <input
                type="number"
                min={0}
                max={999}
                value={eq.pontos.length}
                onChange={(e) =>
                  salvarEquipamentos(
                    equipamentos.map((x, j) => (j === i ? { ...x, pontos: ajustaPontos(x.pontos, parseInt(e.target.value || '0', 10)) } : x)),
                  )
                }
                className={input + ' w-24'}
              />
              <button type="button" onClick={() => salvarEquipamentos(equipamentos.filter((_, j) => j !== i))} className="text-red-500 text-xs font-bold px-2">
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => salvarEquipamentos([...equipamentos, { nome: '', pontos: [] }])}
            className="px-3 py-2 rounded-lg border border-card-border text-xs font-bold text-main"
          >
            Adicionar equipamento
          </button>

          {equipamentos
            .filter((eq) => eq.nome.trim() && eq.pontos.length)
            .map((eq, iEq) => (
              <div key={iEq} className="border border-card-border rounded-lg overflow-hidden mt-2">
                <div className="bg-background px-3 py-2 text-xs font-bold text-main">
                  {eq.nome} — {eq.pontos.length} {eq.pontos.length === 1 ? 'ponto' : 'pontos'}
                </div>
                <div className="p-3 space-y-2">
                  {eq.pontos.map((p, iP) => (
                    <div key={iP} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-card-border/40 rounded px-2 py-1">{p.numero}</span>
                      <input
                        type="text"
                        value={p.local}
                        onChange={(e) => {
                          const novos = equipamentos.map((x) =>
                            x.nome === eq.nome ? { ...x, pontos: x.pontos.map((pp, k) => (k === iP ? { ...pp, local: e.target.value } : pp)) } : x,
                          );
                          salvarEquipamentos(novos);
                        }}
                        className={input}
                        placeholder="Local — ex.: Salão, Tesouraria"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
