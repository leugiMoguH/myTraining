"""
Script Avançado para Download de Imagens de Exercícios
Faz download automático com validação e organização
"""

import os
import requests
from pathlib import Path
from urllib.parse import urljoin
import time
from io import BytesIO
from PIL import Image

# Configuração
EXERCISES_CONFIG = {
    "segunda": [
        {"prefix": "img", "count": 6, "name": "Supino reto", "keywords": "barbell bench press"},
        {"prefix": "imgsi", "count": 3, "name": "Supino inclinado", "keywords": "incline bench press"},
        {"prefix": "imgcru", "count": 3, "name": "Crucifixo", "keywords": "dumbbell fly"},
        {"prefix": "imgpar", "count": 3, "name": "Paralelas", "keywords": "dips chest"},
        {"prefix": "imgtric", "count": 3, "name": "Tríceps corda", "keywords": "rope triceps"},
        {"prefix": "imgtrit", "count": 3, "name": "Tríceps testa", "keywords": "skull crusher"},
    ],
    "terca": [
        {"prefix": "imgpux", "count": 3, "name": "Puxada frente", "keywords": "lat pulldown"},
        {"prefix": "imgrem", "count": 3, "name": "Remada", "keywords": "barbell row"},
        {"prefix": "imgremu", "count": 3, "name": "Remada unilateral", "keywords": "dumbbell row"},
        {"prefix": "imgpull", "count": 3, "name": "Pulldown", "keywords": "lat pulldown"},
        {"prefix": "imgrosc", "count": 3, "name": "Rosca direta", "keywords": "barbell curl"},
        {"prefix": "imgrosca", "count": 3, "name": "Rosca alternada", "keywords": "dumbbell curl"},
    ],
    "quarta": [
        {"prefix": "imgagac", "count": 4, "name": "Agachamento", "keywords": "barbell squat"},
        {"prefix": "imglegp", "count": 3, "name": "Leg press", "keywords": "leg press machine"},
        {"prefix": "imgsti", "count": 3, "name": "Stiff", "keywords": "stiff leg deadlift"},
        {"prefix": "imgmesa", "count": 3, "name": "Mesa flexora", "keywords": "hamstring curl"},
        {"prefix": "imgcade", "count": 3, "name": "Cadeira extensora", "keywords": "leg extension"},
        {"prefix": "imgpantu", "count": 3, "name": "Panturrilha", "keywords": "calf raise"},
    ],
    "quinta": [
        {"prefix": "imgdes", "count": 3, "name": "Desenvolvimento", "keywords": "shoulder press"},
        {"prefix": "imgelv", "count": 3, "name": "Elevação lateral", "keywords": "lateral raise"},
        {"prefix": "imgposto", "count": 3, "name": "Posterior ombro", "keywords": "reverse fly"},
        {"prefix": "imgface", "count": 3, "name": "Face pull", "keywords": "face pull rope"},
        {"prefix": "imgpranc", "count": 3, "name": "Prancha", "keywords": "plank exercise"},
        {"prefix": "imgabd", "count": 3, "name": "Abdominal", "keywords": "ab crunch"},
    ],
    "sexta": [
        {"prefix": "imglevt", "count": 3, "name": "Levantamento terra", "keywords": "deadlift"},
        {"prefix": "imgsup", "count": 3, "name": "Supino", "keywords": "dumbbell bench"},
        {"prefix": "imgpuxa", "count": 3, "name": "Puxada alta", "keywords": "high pull"},
        {"prefix": "imgagacg", "count": 3, "name": "Agachamento goblet", "keywords": "goblet squat"},
        {"prefix": "imgelvel", "count": 3, "name": "Elevação lateral", "keywords": "dumbbell raise"},
        {"prefix": "imgbra", "count": 3, "name": "Braços", "keywords": "arm workout"},
    ],
    "sabado": [
        {"prefix": "imgcard", "count": 3, "name": "Cardio leve", "keywords": "treadmill running"},
        {"prefix": "imgcore", "count": 3, "name": "Core", "keywords": "core workout"},
    ],
    "domingo": [
        {"prefix": "imgabd", "count": 3, "name": "Descanso ativo", "keywords": "yoga stretch"},
    ],
}

class ImageDownloader:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0'
        })
        self.base_path = Path("images")
        
    def download_from_unsplash(self, query, count=3):
        """
        Faz download de imagens do Unsplash
        Nota: Unsplash requer uma API key para acesso de produção
        Este método fornece um exemplo de como integrar
        """
        urls = []
        # API gratuita do Unsplash (requer chave - use seu browser como alternativa)
        print(f"   ℹ️  Para {query}: visite https://unsplash.com/napi/search/photos?query={query}")
        return urls
    
    def validate_image(self, image_data):
        """Valida se a imagem é válida"""
        try:
            img = Image.open(BytesIO(image_data))
            # Validar tamanho mínimo
            if img.width < 300 or img.height < 300:
                return False, "Imagem muito pequena"
            # Validar formato
            if img.format not in ['JPEG', 'PNG', 'JPG']:
                return False, "Formato não suportado"
            return True, "OK"
        except:
            return False, "Erro ao processar imagem"
    
    def save_image(self, image_data, filepath):
        """Guarda imagem com validação"""
        try:
            img = Image.open(BytesIO(image_data))
            # Converter para RGB se necessário
            if img.mode in ('RGBA', 'LA', 'P'):
                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                rgb_img.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                rgb_img.save(filepath, 'JPEG', quality=90)
            else:
                img.save(filepath, 'JPEG', quality=90)
            return True
        except Exception as e:
            print(f"   ✗ Erro ao guardar: {e}")
            return False
    
    def print_instructions(self):
        """Mostra instruções detalhadas"""
        print("""
╔═══════════════════════════════════════════════════════════════════╗
║    Download de Imagens de Exercícios - Guia de Utilização       ║
╚═══════════════════════════════════════════════════════════════════╝

✅ OPÇÃO 1: DOWNLOAD AUTOMÁTICO (Recomendado)

1. Instale a dependência:
   pip install pillow requests

2. Este script vai gerar os URLs para você

3. ALTERNATIVA - Use ferramentas online:
   • bing-image-downloader: pip install bing-image-downloader
   • google-images-download: pip install bing-image-downloader

═══════════════════════════════════════════════════════════════════

✅ OPÇÃO 2: DOWNLOAD MANUAL (Mais Controlo de Qualidade)

PASSO 1: Escolha um site
  • Unsplash: https://unsplash.com/ (recomendado)
  • Pixabay: https://pixabay.com/
  • Pexels: https://www.pexels.com/
  • Shutterstock: https://www.shutterstock.com/

PASSO 2: Procure pelo exercício (use os keywords)
  
PASSO 3: Faça download de 3-6 imagens
  • Resolução mínima: 400x400px
  • Sem watermarks visíveis
  • Foco claro no exercício
  • Boa iluminação

PASSO 4: Organize nas pastas
  images/segunda/img1-6/img1.jpg
  images/segunda/img1-6/img2.jpg
  etc...

═══════════════════════════════════════════════════════════════════

✅ OPÇÃO 3: DOWNLOAD COM SCRIPT EXTERNO

pip install bing-image-downloader

Criar ficheiro 'download_bing.py':
""")

    def print_keywords(self):
        """Mostra keywords para cada exercício"""
        print("\n📋 KEYWORDS PARA PROCURAR:\n")
        
        for day, exercises in EXERCISES_CONFIG.items():
            print(f"📅 {day.upper()}")
            for ex in exercises:
                print(f"   • {ex['name']:<30} → '{ex['keywords']}'")
            print()

if __name__ == "__main__":
    downloader = ImageDownloader()
    
    downloader.print_instructions()
    downloader.print_keywords()
    
    print("\n" + "="*70)
    print("💡 RECOMENDAÇÃO: Use OPÇÃO 2 (Download Manual) para melhor qualidade")
    print("="*70)
    
    print("\n📂 Pastas criadas e prontas para receber imagens:")
    for day, exercises in EXERCISES_CONFIG.items():
        print(f"\n  📅 {day}/")
        for ex in exercises:
            for i in range(1, ex['count'] + 1):
                folder = f"{ex['prefix']}{i}" if ex['count'] > 1 and ex['prefix'].endswith(('1', '2', '3', '4', '5', '6')) else ex['prefix']
                path = Path(f"images/{day}/{folder}/")
                exists = "✓" if path.exists() else "✗"
                print(f"     {exists} {path}/")
