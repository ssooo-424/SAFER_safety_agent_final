import matplotlib.pyplot as plt
import matplotlib.patches as patches

def create_fig2():
    fig, ax = plt.subplots(figsize=(10, 8), dpi=300)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.axis('off')

    # 스타일 설정
    box_blue = {'bg': '#E3F2FD', 'edge': '#1565C0', 'txt': '#0D47A1'}
    box_orange = {'bg': '#FFF3E0', 'edge': '#E65100', 'txt': '#E65100'}
    box_green = {'bg': '#E8F5E9', 'edge': '#2E7D32', 'txt': '#1B5E20'}

    # 1. 상단 루트 박스
    rect_top = patches.FancyBboxPatch((2.5, 8.2), 5, 1.2, boxstyle="round,pad=0.2",
                                      linewidth=1.5, edgecolor=box_blue['edge'], facecolor=box_blue['bg'])
    ax.add_patch(rect_top)
    ax.text(5, 8.8, "Candidate Rule Pool Generation", fontsize=11, fontweight='bold', color=box_blue['txt'], ha='center', va='center')

    # 2. 분기선 & 화살표
    ax.plot([5, 5], [8.2, 7.5], color='#555555', lw=1.5)
    ax.plot([2.5, 7.5], [7.5, 7.5], color='#555555', lw=1.5)
    ax.annotate('', xy=(2.5, 6.8), xytext=(2.5, 7.5), arrowprops=dict(arrowstyle="->", lw=1.5, color='#555555'))
    ax.annotate('', xy=(7.5, 6.8), xytext=(7.5, 7.5), arrowprops=dict(arrowstyle="->", lw=1.5, color='#555555'))

    # 3. 왼쪽 분기 (Scenario Measures < 3)
    rect_left = patches.FancyBboxPatch((0.5, 3.8), 4, 3.0, boxstyle="round,pad=0.2",
                                       linewidth=1.5, edgecolor=box_orange['edge'], facecolor=box_orange['bg'])
    ax.add_patch(rect_left)
    ax.text(2.5, 6.3, "Scenario Measures < 3", fontsize=10.5, fontweight='bold', color=box_orange['txt'], ha='center')
    left_text = "Sequential Rule Filling:\n• Slot 1: Scenario Measure\n• Slot 2: Trigger-Based Rule\n• Slot 3: Persona-Trigger Rule\n\n(Ensures 3 Rules Always)"
    ax.text(0.8, 5.5, left_text, fontsize=9, color='#333333', va='top', linespacing=1.3)

    # 4. 오른쪽 분기 (Scenario Measures ≥ 3)
    rect_right = patches.FancyBboxPatch((5.5, 3.8), 4, 3.0, boxstyle="round,pad=0.2",
                                        linewidth=1.5, edgecolor=box_orange['edge'], facecolor=box_orange['bg'])
    ax.add_patch(rect_right)
    ax.text(7.5, 6.3, "Scenario Measures ≥ 3", fontsize=10.5, fontweight='bold', color=box_orange['txt'], ha='center')
    right_text = "Multi-Attribute Scoring:\n• Directness (40 pt)\n• Trigger Relevance (30 pt)\n• Actionability (20 pt)\n• Diversity (10 pt)\n\n→ Rank & Select Top 3"
    ax.text(5.8, 5.5, right_text, fontsize=9, color='#333333', va='top', linespacing=1.3)

    # 5. 아래쪽 병합 화살표
    ax.plot([2.5, 2.5], [3.8, 3.0], color='#555555', lw=1.5)
    ax.plot([7.5, 7.5], [3.8, 3.0], color='#555555', lw=1.5)
    ax.plot([2.5, 7.5], [3.0, 3.0], color='#555555', lw=1.5)
    ax.annotate('', xy=(5, 2.2), xytext=(5, 3.0), arrowprops=dict(arrowstyle="->", lw=1.5, color='#555555'))

    # 6. 하단 결과 박스
    rect_bot = patches.FancyBboxPatch((2.0, 0.8), 6, 1.3, boxstyle="round,pad=0.2",
                                      linewidth=1.5, edgecolor=box_green['edge'], facecolor=box_green['bg'])
    ax.add_patch(rect_bot)
    ax.text(5, 1.45, "Final 3 Personalised Safety Rules Displayed", fontsize=11, fontweight='bold', color=box_green['txt'], ha='center', va='center')

    plt.tight_layout()
    plt.savefig("Figure2_Selection_Logic.png", bbox_inches='tight')
    print("✅ Figure2_Selection_Logic.png 저장 완료!")

if __name__ == "__main__":
    create_fig2()