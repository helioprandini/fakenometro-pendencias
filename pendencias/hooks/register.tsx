import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Pendencia, Quadro } from '../types'

const PANE = 'pendencias'
const TITULO = 'Pendências'
const SEGUNDOS = 30
// Os quadros moram no servidor (saida/pendencias.json), os mesmos da aba Pendências do cockpit (Roberta, 2026-11-01).
const API = 'https://protozoan-enjoyer-poncho.ngrok-free.dev/cockpit/pendencias'
const quadros = atom({ plugin: 'pendencias', key: 'quadros' } as const, [])
const erro = atom({ plugin: 'pendencias', key: 'erro' } as const, '')

export const abertas = (dados: { quadros?: Quadro[] }): Quadro[] =>
  (dados.quadros ?? [])
    .map(q => ({ nome: q.nome, itens: q.itens.filter(i => !i.feita) }))
    .filter(q => q.itens.length)

// O site do Claude não desenha o painel: o comando também devolve a lista como texto.
export const listar = (lista: Quadro[]): string => {
  if (!lista.length) return 'Nenhuma pendência.'
  return lista.map(q => [q.nome, ...q.itens.map(i => `#${i.id} ${i.texto}`)].join('\n')).join('\n\n')
}

const form = (campos: Record<string, string>) =>
  Object.entries(campos).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')

let chave = ''
let quadroPadrao = 'EDITORIAL INSTAGRAM'
const cabecalho = () => ({ 'X-Chave': chave, 'ngrok-skip-browser-warning': '1' })

// A chave vem das opções do plugin ou do campo do próprio painel (guardada no $.store deste computador).
async function carregar($: any) {
  if (!chave) chave = String((await $.store.get('chave')) ?? '')
  if (!chave) return update($, erro, () => 'falta-chave')
  const r = await $.http.fetch(API, { headers: cabecalho() }).catch(() => null)
  if (!r?.ok) return update($, erro, () => `Não consegui ler as pendências (${r?.status ?? 'sem rede'}).`)
  const novos = abertas(JSON.parse(r.text))
  await update($, erro, () => '')
  await update($, quadros, () => novos)
}

async function enviar($: any, caminho: string, campos: Record<string, string>) {
  await $.http.fetch(API + caminho, {
    method: 'POST',
    headers: { ...cabecalho(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form(campos),
  }).catch(() => null)
  await carregar($)
}

export const register: Register = (on, options) => {
  chave = String(options.chave ?? '')
  quadroPadrao = String(options.quadro ?? 'EDITORIAL INSTAGRAM')

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'pendencias', description: 'Abre o quadro de pendências' })
    await carregar($)
    $.clock.every(SEGUNDOS * 1000, () => carregar($))
    void $.ui.open({ id: PANE, title: TITULO })

    return next(e)
  })

  on('command.run', { command: 'pendencias' }, async $ => {
    await carregar($)
    await $.ui.open({ id: PANE, title: TITULO })
    const falha = await read($, erro)

    return { text: falha === 'falta-chave' ? 'Cole a chave do cockpit no campo do painel Pendências.' : falha || listar(await read($, quadros)) }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input } = $.ui.resolve(e) as any
    const lista = await read($, quadros)
    const falha = await read($, erro)

    return (
      <Box flexDirection="column" gap={1}>
        {falha === 'falta-chave' && Input && (
          <Input
            key="chave"
            placeholder="Cole aqui a chave do cockpit (o código depois de #k=)"
            submitLabel="salvar"
            onSubmit={async (valor: string) => {
              const k = valor.trim().replace(/^.*#k=/, '')
              if (!k) return
              await $.store.set('chave', k)
              chave = k
              await carregar($)
            }}
          />
        )}
        {falha && falha !== 'falta-chave' && <Text>{falha}</Text>}
        {!falha && Input && (
          <Input
            key="nova"
            placeholder={`Nova pendência (${quadroPadrao})`}
            submitLabel="guardar"
            onSubmit={async (valor: string) => {
              const t = valor.trim().replace(/\s+/g, ' ')
              if (t) await enviar($, '', { quadro: quadroPadrao, texto: t })
            }}
          />
        )}
        {!falha && lista.length === 0 && <Text dimColor>Nenhuma pendência.</Text>}
        {lista.map(q => (
          <Box key={`q-${q.nome}`} flexDirection="column">
            <Text bold>{q.nome}</Text>
            {q.itens.map((p: Pendencia) => (
              <Box key={`i-${p.id}`} flexDirection="column">
                <Text>{`#${p.id} ${p.texto}`}</Text>
                <Button key={`feita-${p.id}`} label="Concluir" onPress={() => enviar($, `/${p.id}/feita`, {})} />
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    )
  })
}
