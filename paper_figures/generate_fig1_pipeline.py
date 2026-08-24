import matplotlib.pyplot as plt
import matplotlib.patches as patches

def create_fig1():
    # 그래프 기본 설정
    fig, ax = plt.subplots(figsize=(10, 13), dpi=300)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 15)
    ax.axis('off')

    # 색상 정의
    c_input = {'bg': '#E3F2FD', 'edge': '#1565C0', 'txt': '#0D47A1'}
    c_proc  = {'bg': '#FFF3E0', 'edge': '#E65100', 'txt': '#E65100'}
    c_out   = {'bg': '#E8F5E9', 'edge': '#2E7D32', 'txt': '#1B5E20'}

    # 박스 데이터 (Y위치, 색상, 제목, 세부내용)
    boxes = [
        (12.2, c_input, "INPUT DATA LAYER", 
         "• Construction Risk Assessment Data (Work, Hazard, Raw Measures)\n• Selected Accident Trigger (T1–T7)\n• Worker Safety Persona (FA / DA / IC / IR)"),
        
        (9.4, c_proc, "STEP 1: RULE-BASED PREPROCESSING", 
         "• Sentence Segmentation (Separators: \\n, ;, .)\n• Preservation of Safety Terms & Lists (Commas, Slashes)\n• Action-Verb Standardisation (e.g., 'Installation' → 'Check/Install')"),
        
        (6.3, c_proc, "STEP 2: LLM CONTEXTUALISATION & CANDIDATE POOL", 
         "• Scenario Context Embedding (Work Context + Hazard Prevention)\n• Worker-Centric Reframing (Actionable Format)\n• Multi-Layer Candidate Generation (Scenario / Trigger / Persona)"),
        
        (3.5, c_proc, "STEP 3: SCORING & SELECTION ENGINE", 
         "• Rank & Select Top 3 Rules based on Multi-Attribute Score (Max 100 pt):\n  - Directness (40%) + Trigger Fit (30%) + Actionability (20%) + Diversity (10%)"),
        
        (0.7, c_out, "FINAL DISPLAY & WORKER COMMITMENT UI", 
         "• Top 3 Personalised Action Rules + Persona Behavioral Prompts\n• Mandatory Rule Verification (Checkboxes)\n• Primary Rule Selection & Safety Pledge Generation")
    ]

    # 박스 그리기
    for y, color, title, desc in boxes:
        rect = patches.FancyBboxPatch((0.5, y), 9, 2.1, boxstyle="round,pad=0.3",
                                      linewidth=1.5, edgecolor=color['edge'], facecolor=color['bg'])
        ax.add_patch(rect)
        ax.text(0.8, y + 1.65, title, fontsize=11, fontweight='bold', color=color['txt'], va='top')
        ax.text(0.8, y + 1.2, desc, fontsize=9.5, color='#333333', va='top', linespacing=1.4)

    # 화살표 그리기
    arrow_y_positions = [12.0, 9.2, 6.1, 3.3]
    for ay in arrow_y_positions:
        ax.annotate('', xy=(5, ay - 0.7), xytext=(5, ay),
                    arrowprops=dict(arrowstyle="->,head_width=0.4,head_length=0.6", lw=2, color='#555555'))

    plt.tight_layout()
    plt.savefig("Figure1_Pipeline.png", bbox_inches='tight')
    print("✅ Figure1_Pipeline.png 저장 완료!")

if __name__ == "__main__":
    create_fig1()