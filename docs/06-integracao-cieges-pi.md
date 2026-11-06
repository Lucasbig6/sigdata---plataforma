# 06 · Integração com o CIEGES PI

> **Status: proposta.** Os requisitos do CIEGES PI ainda não foram levantados neste repositório. Esta página reúne o que o
> SIGDATA já oferece para integração, as opções possíveis e as perguntas que precisam de resposta antes de implementar.
> Nada aqui está implementado como integração específica.

## O que o SIGDATA já oferece

| Capacidade | Onde | Serve para |
|---|---|---|
| Conectores ao vivo (PostgreSQL, MySQL/MariaDB, SQL Server) | `backend/src/sources/` | Ler dados do CIEGES PI direto no banco, em somente leitura |
| Importação de **API REST** | fonte do tipo `api` | Trazer dados de uma API do CIEGES PI para o DuckDB, com atualização manual |
| Importação de CSV/XLSX e Google Sheets | fontes de arquivo e `gsheets` | Cargas pontuais ou planilhas compartilhadas |
| Datasets publicados | `/api/sources/:id/publish` | Entregar dados já tratados a todos os usuários |
| Dashboards com link público ou acesso por pessoa | `/api/public/dashboards/:token` | Disponibilizar painéis fora do SIGDATA |
| Perfis (usuário, analista, administrador) | `shared/roles.ts` | Mapear papéis de outro sistema |
| Registro de atividades | `audit_log` | Rastreabilidade |
| Login por e-mail e senha (Better Auth) | `backend/src/auth.ts` | Base para adicionar outros provedores de login |

## Cenários de integração

### A · Dados do CIEGES PI dentro do SIGDATA (o mais simples)

O SIGDATA lê os dados do CIEGES PI e os analisa.

- **Banco**: criar um usuário **somente leitura** no banco do CIEGES PI e cadastrá-lo como fonte ao vivo.
- **API**: cadastrar um endpoint como fonte de API REST. Os dados são importados; "Atualizar dados" busca de novo.
- Um analista prepara e **publica** o dataset, e os usuários o usam no chat e nos dashboards.

Nada precisa mudar no código para esse cenário, só configuração e permissões de rede (veja a nota sobre `SIGDATA_ALLOW_PRIVATE_HOSTS`).

### B · Painéis do SIGDATA dentro do CIEGES PI

O CIEGES PI mostra os dashboards do SIGDATA.

- **Link público** em somente leitura, aberto numa nova aba ou num quadro incorporado. Hoje a página pública não foi configurada
  para ser incorporada: antes de usar em `iframe` é preciso definir uma política de cabeçalhos (`frame-ancestors`) que permita o
  domínio do CIEGES PI.
- **Dashboards compartilhados com pessoas logadas** exigem que a pessoa tenha conta no SIGDATA.

### C · Login único (SSO)

O CIEGES PI e o SIGDATA compartilham a identidade da pessoa. O Better Auth permite adicionar provedores (por exemplo OIDC), mas isso
**não está configurado**. Precisa de decisão sobre o provedor de identidade e sobre como mapear perfis.

### D · API para o CIEGES PI consumir

Hoje a API é pensada para o próprio frontend (sessão por cookie). Para o CIEGES PI chamá-la de servidor para servidor seria
preciso adicionar **chaves de API** ou tokens de serviço e documentar um subconjunto estável de rotas. Isso **não existe** ainda.

## Perguntas em aberto

1. O CIEGES PI expõe os dados por **banco, API ou arquivos**? Quais?
2. Qual o **volume** e a frequência de atualização (tempo real, diário, sob demanda)?
3. Os dados têm **dados pessoais** (LGPD)? Quem pode ver o quê? É preciso filtrar por unidade, município ou perfil?
4. Haverá **login único**? Qual provedor de identidade?
5. Os dashboards ficam **só no SIGDATA** ou precisam aparecer dentro do CIEGES PI?
6. Onde cada sistema vai rodar (mesma rede, nuvem, órgão)? Há restrição de saída para a internet, que afeta o provedor de IA?
7. O assistente de IA pode enviar esquema e amostras a um provedor externo, ou é preciso **modelo local** (o SIGDATA aceita Ollama
   e qualquer API no formato OpenAI)?

## Pontos de atenção

- **IA e privacidade**: o assistente envia ao provedor o **esquema** da fonte e **amostras de linhas** das consultas. Se os dados forem
  sensíveis, use um modelo local ou revise o que é enviado antes de produção.
- **Leitura somente**: o SIGDATA nunca grava nos bancos de origem. Mantenha isso com usuários de banco só de leitura.
- **Rede**: em produção, hosts de rede interna são recusados por padrão. Libere só os necessários.
- **Dashboards públicos** mostram dados ao vivo a quem tiver o link. Defina validade e revogue links que não forem mais necessários.

## Próximos passos sugeridos

1. Responder às perguntas acima com a equipe do CIEGES PI.
2. Começar pelo cenário **A** com um dataset real e um dashboard piloto.
3. Decidir SSO (**C**) e acesso por API (**D**) só depois de validar o piloto.
