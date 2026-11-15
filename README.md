Documentação da API SPHEREx
Referência técnica completa para integração e uso do endpoint de busca astronômica
Visão Geral
A API SPHEREx (estruturada em Flask) atua como um intermediário inteligente para consultar bases de dados astronômicas do IRSA (Infrared Science Archive), incluindo o levantamento SPHEREx. Seu objetivo central é:
• Receber coordenadas celestes (RA/Dec)
• Filtrar dados por bandas espectrais e períodos temporais
• Calcular o registro com maior assertividade astrométrica — o objeto mais próximo do alvo usando o método argmin em coordenadas esféricas via SkyCoord
• Retornar metadados prontos para visualizadores, como URLs de arquivos FITS e recomendações de zoom/FOV
Endpoint Principal
GET /api/search-spherex
Parâmetros de Requisição
Parâmetro
Tipo
Obrigatório?
Descrição / Padrão
ra
float
✅ Sim
Ascensão Reta em graus (ex: 150.123)
dec
float
✅ Sim
Declinação em graus (ex: 2.456)
radius
float
❌ Não
Raio inicial de busca em segundos de arco (padrão: 60.0)
band
string
❌ Não
Banda SPHEREx: "d1", "d2", "d3", "d4", "d5", "d6" (padrão: "d1")
collection
string
❌ Não
Coleção IRSA SIA ativa: "spherex_dr1", "spherex_qr3", etc. (padrão: "spherex_dr1")
period
string
❌ Não
Filtro de período temporal: "2025", "2026-recente" ou "all" (padrão: "all")
Exemplos de Requisição
Python (requests)
import requests

url = "http://localhost:5000/api/search-spherex"
params = {
    "ra": 150.123,
    "dec": 2.456,
    "radius": 60.0,
    "band": "d1",
    "collection": "spherex_dr1",
    "period": "2025"
}

response = requests.get(url, params=params)

if response.status_code == 200:
    data = response.json()
    print("Sucesso:", data)
else:
    print(f"Erro {response.status_code}:", response.json())
cURL (Terminal)
curl -X GET "http://localhost:5000/api/search-spherex?ra=150.123&dec=2.456&radius=60&band=d1&collection=spherex_dr1&period=all"
JavaScript (fetch)
const params = new URLSearchParams({
    ra: "150.123",
    dec: "2.456",
    radius: "60",
    band: "d1",
    collection: "spherex_dr1",
    period: "all"
});

fetch(`http://localhost:5000/api/search-spherex?${params}`)
    .then(response => response.json())
    .then(data => console.log(data))
    .catch(error => console.error('Erro:', error));
Lógica Interna
Fluxo de Processamento
1.  Recepção — O endpoint recebe os parâmetros via query string (GET)
2.  Validação — RA e Dec são verificados como obrigatórios; os demais assumem valores padrão
3.  Consulta IRSA — A API faz uma requisição SIA à coleção especificada com o raio fornecido
4.  Filtragem por banda — Os resultados são filtrados pela banda espectral selecionada (d1–d6)
5.  Filtragem por período — Aplica-se o filtro temporal (2025, 2026-recente ou all)
6.  Cálculo astrométrico — Usa SkyCoord.argmin() para encontrar o objeto mais próximo das coordenadas-alvo em coordenadas esféricas
7.  Resposta — Retorna metadados incluindo URL do arquivo FITS, FOV recomendado e dados do objeto
Método de Assertividade Astrométrica
A seleção do melhor registro utiliza distância angular esférica real via astropy.coordinates.SkyCoord, evitando distorções de projeção plana comuns em buscas de alta declinação:
from astropy.coordinates import SkyCoord
import astropy.units as u

target = SkyCoord(ra=ra*u.degree, dec=dec*u.degree)
catalog = SkyCoord(ra=results['ra']*u.degree, dec=results['dec']*u.degree)
best_idx = target.separation(catalog).argmin()
Bandas Espectrais SPHEREx
Banda
Canal
Cobertura Espectral
d1
Canal 1
~0,75 – 1,1 µm
d2
Canal 2
~1,1 – 1,6 µm
d3
Canal 3
~1,6 – 2,4 µm
d4
Canal 4
~2,4 – 3,8 µm
d5
Canal 5
~3,8 – 4,4 µm
d6
Canal 6
~4,4 – 5,0 µm
Coleções IRSA Disponíveis
Coleção
Descrição
spherex_dr1
SPHEREx Data Release 1 (padrão)
spherex_qr3
SPHEREx Quick Release 3
Respostas da API
Sucesso (200 OK)
{
  "status": "success",
  "ra": 150.123,
  "dec": 2.456,
  "band": "d1",
  "collection": "spherex_dr1",
  "best_match": {
    "ra": 150.1241,
    "dec": 2.4572,
    "separation_arcsec": 3.87,
    "fits_url": "https://irsa.ipac.caltech.edu/...",
    "fov_recommendation": 0.1,
    "period": "2025"
  }
}
Erro — Parâmetro ausente (400 Bad Request)
{
  "status": "error",
  "message": "Parâmetros 'ra' e 'dec' são obrigatórios."
}
Erro — Nenhum resultado encontrado (404 Not Found)
{
  "status": "error",
  "message": "Nenhum objeto encontrado para as coordenadas fornecidas dentro do raio especificado."
}
Dependências
Flask>=2.0
astropy>=5.0
requests>=2.28
pyvo>=1.4
Instale com:
pip install flask astropy requests pyvo
Considerações de Uso
• Raio adaptativo: caso nenhum resultado seja encontrado com o raio fornecido, a API pode expandir automaticamente o raio de busca em incrementos definidos internamente.
• FITS para visualizadores: a URL retornada é compatível com visualizadores como Aladin Lite, JS9 e Astroquery.
• FOV recomendado: calculado com base no tamanho angular do campo da imagem retornada, útil para configurar o zoom inicial em visualizadores.
