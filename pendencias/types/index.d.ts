export type Pendencia = { id: number; texto: string; feita: boolean }
export type Quadro = { nome: string; itens: Pendencia[] }

declare module 'claude-code' {
  interface PluginState {
    pendencias: { quadros: Quadro[]; erro: string }
  }
}
