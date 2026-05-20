"""
Script para fazer download automático de imagens de exercícios
Usa bing-image-downloader para procurar e fazer download de imagens
"""

import os
import shutil
from pathlib import Path

# Mapa de exercícios com keywords de pesquisa
EXERCISES = {
    "segunda": [
        {"folder": "img1-6", "name": "Supino reto", "keywords": "barbell bench press"},
        {"folder": "imgsi", "name": "Supino inclinado", "keywords": "incline bench press"},
        {"folder": "imgcru", "name": "Crucifixo", "keywords": "dumbbell fly pecs"},
        {"folder": "imgpar", "name": "Paralelas", "keywords": "dips chest triceps"},
        {"folder": "imgtric", "name": "Tríceps corda", "keywords": "rope triceps pushdown"},
        {"folder": "imgtrit", "name": "Tríceps testa", "keywords": "skull crusher"},
    ],
    "terca": [
        {"folder": "imgpux", "name": "Puxada frente", "keywords": "lat pulldown front"},
        {"folder": "imgrem", "name": "Remada", "keywords": "barbell row"},
        {"folder": "imgremu", "name": "Remada unilateral", "keywords": "single arm dumbbell row"},
        {"folder": "imgpull", "name": "Pulldown", "keywords": "lat pulldown"},
        {"folder": "imgrosc", "name": "Rosca direta", "keywords": "barbell curl biceps"},
        {"folder": "imgrosca", "name": "Rosca alternada", "keywords": "dumbbell curl"},
    ],
    "quarta": [
        {"folder": "imgagac", "name": "Agachamento", "keywords": "barbell squat"},
        {"folder": "imglegp", "name": "Leg press", "keywords": "leg press machine"},
        {"folder": "imgsti", "name": "Stiff", "keywords": "deadlift stiff leg"},
        {"folder": "imgmesa", "name": "Mesa flexora", "keywords": "hamstring curl machine"},
        {"folder": "imgcade", "name": "Cadeira extensora", "keywords": "leg extension machine"},
        {"folder": "imgpantu", "name": "Panturrilha", "keywords": "calf raises"},
    ],
    "quinta": [
        {"folder": "imgdes", "name": "Desenvolvimento", "keywords": "shoulder press dumbbell"},
        {"folder": "imgelv", "name": "Elevação lateral", "keywords": "lateral raise shoulders"},
        {"folder": "imgposto", "name": "Posterior ombro", "keywords": "reverse fly shoulder"},
        {"folder": "imgface", "name": "Face pull", "keywords": "face pull rope"},
        {"folder": "imgpranc", "name": "Prancha", "keywords": "plank core exercise"},
        {"folder": "imgabd", "name": "Abdominal", "keywords": "ab crunch abs"},
    ],
    "sexta": [
        {"folder": "imglevt", "name": "Levantamento terra", "keywords": "deadlift barbell"},
        {"folder": "imgsup", "name": "Supino", "keywords": "bench press dumbbell"},
        {"folder": "imgpuxa", "name": "Puxada alta", "keywords": "high pull exercise"},
        {"folder": "imgagacg", "name": "Agachamento goblet", "keywords": "goblet squat"},
        {"folder": "imgelvel", "name": "Elevação lateral", "keywords": "dumbbell lateral raise"},
        {"folder": "imgbra", "name": "Braços", "keywords": "arm workout biceps triceps"},
    ],
    "sabado": [
        {"folder": "imgcard", "name": "Cardio leve", "keywords": "treadmill running cardio"},
        {"folder": "imgcore", "name": "Core", "keywords": "core workout abs training"},
    ],
    "domingo": [
        {"folder": "imgabd", "name": "Descanso ativo", "keywords": "yoga stretching mobility"},
    ],
}

def print_instructions():
    """Mostra instruções de como usar o script"""
    print("""
╔═══════════════════════════════════════════════════════════════════╗
║           Script de Download de Imagens de Exercícios           ║
╚═══════════════════════════════════════════════════════════════════╝

⚠️  INSTRUÇÕES IMPORTANTES:

Este script foi criado para guiá-lo no processo de encontrar e 
fazer download de imagens de qualidade para os seus exercícios.

OPÇÕES DE DOWNLOAD:

1️⃣  OPÇÃO AUTOMÁTICA (Recomendada com pip install):
   - Instale: pip install bing-image-downloader
   - Execute: python download_images.py

2️⃣  OPÇÃO MANUAL (Recomendada):
   - Vá a https://unsplash.com/ ou https://pixabay.com/
   - Procure por cada exercício (ex: "barbell squat")
   - Faça download de 3-6 imagens de boa qualidade
   - Coloque na pasta correspondente (ex: images/quarta/imgagac/)
   - Renomeie para: img1.jpg, img2.jpg, etc.

3️⃣  OPÇÃO GOOGLE IMAGES:
   - Clique direito > "Procurar imagem com Google"
   - Procure por termos como "barbell bench press"
   - Filtre por tamanho (grande) e tipo (foto)
   - Faça download

ESTRUTURA DE PASTAS:
images/
├── segunda/imgagac/ (para img1.jpg, img2.jpg, etc.)
├── segunda/imgsi/
└── ...

QUALIDADE DAS IMAGENS:
✓ Resolução mínima: 400x400px
✓ Sem watermarks
✓ Formato: JPG ou PNG
✓ Foco claro no exercício
✓ Boa iluminação
✓ Sem rostos/pessoas identificáveis

RECURSOS RECOMENDADOS:
- Unsplash: https://unsplash.com/ (grátis, sem conta)
- Pixabay: https://pixabay.com/ (grátis, sem conta)
- Pexels: https://www.pexels.com/ (grátis, sem conta)
- ExerciseDB: https://exercisedb.io/ (API com imagens)

""")

if __name__ == "__main__":
    print_instructions()
    
    # Criar estrutura de pastas
    print("\n📁 Criando estrutura de pastas...\n")
    
    base_path = Path("images")
    
    for day, exercises in EXERCISES.items():
        for exercise in exercises:
            folder = exercise["folder"]
            # Extrair números (ex: "img1-6" -> cria img1 até img6)
            if "-" in folder:
                prefix = folder.split("-")[0]  # "img1"
                count = int(folder.split("-")[1])  # 6
                for i in range(1, count + 1):
                    path = base_path / day / f"{prefix}{i}"
                    path.mkdir(parents=True, exist_ok=True)
                    print(f"✓ {path}/")
            else:
                path = base_path / day / folder
                path.mkdir(parents=True, exist_ok=True)
                print(f"✓ {path}/")
    
    print("\n" + "="*70)
    print("✅ Estrutura de pastas criada!")
    print("="*70)
    print("""
PRÓXIMOS PASSOS:

1. Escolha o método de download (automático ou manual)

2. Se AUTOMÁTICO:
   pip install bing-image-downloader
   python download_images.py

3. Se MANUAL:
   - Acesse os sites recomendados
   - Procure pelos exercícios (use os keywords abaixo)
   - Faça download para as pastas criadas
   - Renomeie as imagens para: img1.jpg, img2.jpg, etc.

KEYWORDS POR EXERCÍCIO:
""")
    
    for day, exercises in EXERCISES.items():
        print(f"\n📅 {day.upper()}:")
        for exercise in exercises:
            print(f"  • {exercise['name']}: '{exercise['keywords']}'")
