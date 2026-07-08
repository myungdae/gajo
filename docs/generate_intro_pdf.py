#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
가조 AI 컨시어지 소개자료 PDF 생성 스크립트
- 기존 8개 섹션 유지
- 새로운 "9. 실제 GPS 위치 기반 '내 주변 식당 찾기'" 섹션 추가
- 원본 PDF의 색상/레이아웃 스타일을 그대로 재현 (파란 헤더 바, 표, 하이라이트 박스 등)
"""

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    NextPageTemplate, PageBreak, KeepTogether, HRFlowable
)
from reportlab.platypus.flowables import Flowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

# -------------------- 폰트 등록 --------------------
FONT_DIR = "/usr/share/fonts/truetype/nanum/"
pdfmetrics.registerFont(TTFont('NanumGothic', FONT_DIR + 'NanumGothic.ttf'))
pdfmetrics.registerFont(TTFont('NanumGothic-Bold', FONT_DIR + 'NanumGothicBold.ttf'))
pdfmetrics.registerFont(TTFont('NanumGothic-ExtraBold', FONT_DIR + 'NanumGothicExtraBold.ttf'))

# -------------------- 색상 팔레트 (원본 PDF에서 추출) --------------------
MAIN_BLUE = HexColor('#1565C0')
LIGHT_BLUE_BG = HexColor('#F0F4FA')
LIGHT_BLUE_BORDER = HexColor('#DCE4F0')
TABLE_ALT_BG = HexColor('#F4F7FC')
ORANGE_BG = HexColor('#FFF8E1')
ORANGE_BORDER = HexColor('#FF6F00')
GREEN_BG = HexColor('#E8F5E9')
GREEN_BORDER = HexColor('#2E7D32')
GREEN_TEXT = HexColor('#1B5E20')
TEXT_DARK = HexColor('#1A1A1A')
TEXT_GRAY = HexColor('#999999')
WHITE = colors.white

PAGE_W, PAGE_H = A4
MARGIN_L = 57.0
MARGIN_R = 57.0
MARGIN_T = 56.7
MARGIN_B = 56.7
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

styles = getSampleStyleSheet()

style_title = ParagraphStyle('title', fontName='NanumGothic-ExtraBold', fontSize=22,
                              textColor=MAIN_BLUE, alignment=TA_CENTER, leading=28)
style_subtitle = ParagraphStyle('subtitle', fontName='NanumGothic-Bold', fontSize=13,
                                 textColor=ORANGE_BORDER, alignment=TA_CENTER, leading=18)
style_section_header = ParagraphStyle('section_header', fontName='NanumGothic-Bold', fontSize=14,
                                       textColor=WHITE, leading=18, leftIndent=0)
style_body = ParagraphStyle('body', fontName='NanumGothic', fontSize=10.5,
                             textColor=TEXT_DARK, leading=16.5, alignment=TA_LEFT)
style_body_bold = ParagraphStyle('body_bold', fontName='NanumGothic-Bold', fontSize=10.5,
                                  textColor=MAIN_BLUE, leading=16.5)
style_bullet = ParagraphStyle('bullet', fontName='NanumGothic', fontSize=10.5,
                               textColor=TEXT_DARK, leading=16.5, leftIndent=14, bulletIndent=0)
style_quote = ParagraphStyle('quote', fontName='NanumGothic', fontSize=10.3,
                              textColor=TEXT_DARK, leading=16, leftIndent=6)
style_table_header = ParagraphStyle('table_header', fontName='NanumGothic-Bold', fontSize=9.7,
                                     textColor=WHITE, leading=13)
style_table_cell = ParagraphStyle('table_cell', fontName='NanumGothic', fontSize=9.7,
                                   textColor=TEXT_DARK, leading=14)
style_footer = ParagraphStyle('footer', fontName='NanumGothic', fontSize=8,
                               textColor=TEXT_GRAY, alignment=TA_CENTER)
style_flow_center = ParagraphStyle('flow_center', fontName='NanumGothic', fontSize=10.5,
                                    textColor=TEXT_DARK, leading=17, alignment=TA_CENTER)
style_new_badge = ParagraphStyle('new_badge', fontName='NanumGothic-Bold', fontSize=9,
                                  textColor=WHITE, alignment=TA_CENTER, leading=12)


def section_header(number, title_text, bg_color=MAIN_BLUE):
    """섹션 헤더 바 (파란 배경 + 흰 텍스트)"""
    p = Paragraph(f'{number}. {title_text}', style_section_header)
    t = Table([[p]], colWidths=[CONTENT_W], rowHeights=[30])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg_color),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    return t


def new_section_header(number, title_text):
    """새로운 기능 섹션임을 강조하는 헤더 (NEW 배지 포함, 초록색 계열)"""
    badge = Table([[Paragraph('NEW', style_new_badge)]], colWidths=[36], rowHeights=[16])
    badge.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), ORANGE_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    p = Paragraph(f'{number}. {title_text}', style_section_header)
    inner = Table([[p, badge]], colWidths=[CONTENT_W - 55, 55])
    inner.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (0, 0), 0),
        ('RIGHTPADDING', (1, 0), (1, 0), 4),
    ]))
    t = Table([[inner]], colWidths=[CONTENT_W], rowHeights=[30])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor('#1B7A3D')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    return t


def highlight_box(text_html, bg=LIGHT_BLUE_BG, border=LIGHT_BLUE_BORDER, style=style_quote, border_side='LEFT'):
    p = Paragraph(text_html, style)
    t = Table([[p]], colWidths=[CONTENT_W])
    ts = [
        ('BACKGROUND', (0, 0), (-1, -1), bg),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]
    if border_side == 'LEFT':
        ts.append(('LINEBEFORE', (0, 0), (0, 0), 3, border))
    else:
        ts.append(('BOX', (0, 0), (-1, -1), 0.7, border))
    t.setStyle(TableStyle(ts))
    return t


def compare_table(rows, col1_header, col2_header):
    """기존 방식 vs 새 기능 비교 표"""
    data = [[Paragraph(col1_header, style_table_header), Paragraph(col2_header, style_table_header)]]
    for a, b in rows:
        data.append([Paragraph(a, style_table_cell), Paragraph(b, style_table_cell)])
    col_w = CONTENT_W / 2
    t = Table(data, colWidths=[col_w, col_w], repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), MAIN_BLUE),
        ('GRID', (0, 0), (-1, -1), 0.6, LIGHT_BLUE_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_ALT_BG))
    t.setStyle(TableStyle(style_cmds))
    return t


def bullets(items, style=style_bullet):
    flows = []
    for it in items:
        flows.append(Paragraph('• ' + it, style))
        flows.append(Spacer(1, 4))
    return flows


# -------------------- 페이지 템플릿 (헤더/푸터) --------------------
class FooterCanvas:
    def __init__(self):
        self.page_num = 0

    def __call__(self, canvas_obj, doc):
        canvas_obj.saveState()
        canvas_obj.setFont('NanumGothic', 8)
        canvas_obj.setFillColor(TEXT_GRAY)
        canvas_obj.drawCentredString(PAGE_W / 2, 32, "가조 AI 컨시어지 소개자료")
        canvas_obj.drawRightString(PAGE_W - MARGIN_R, 32, str(doc.page))
        canvas_obj.restoreState()


def build_pdf(output_path):
    doc = BaseDocTemplate(
        output_path, pagesize=A4,
        leftMargin=MARGIN_L, rightMargin=MARGIN_R, topMargin=MARGIN_T, bottomMargin=MARGIN_B,
        title="가조 AI 컨시어지 소개자료",
    )
    frame = Frame(MARGIN_L, MARGIN_B, CONTENT_W, PAGE_H - MARGIN_T - MARGIN_B, id='normal')
    footer = FooterCanvas()
    template = PageTemplate(id='main', frames=[frame], onPage=footer)
    doc.addPageTemplates([template])

    flow = []

    # ============ Page 1: 제목 + 1,2 섹션 ============
    flow.append(Spacer(1, 60))
    flow.append(Paragraph('가조 AI 컨시어지', style_title))
    flow.append(Spacer(1, 10))
    flow.append(HRFlowable(width=CONTENT_W, thickness=1.2, color=MAIN_BLUE, spaceBefore=4, spaceAfter=14))
    flow.append(Paragraph('온천단지 전체를 하나의 지식그래프로 이해하는 에이전틱 AI', style_subtitle))
    flow.append(Spacer(1, 14))
    flow.append(HRFlowable(width=CONTENT_W, thickness=0.6, color=LIGHT_BLUE_BORDER, spaceBefore=0, spaceAfter=20))

    flow.append(section_header('1', '무엇이 문제였나요?'))
    flow.append(Spacer(1, 10))
    flow.append(Paragraph(
        '거창 가조 온천단지를 찾는 방문객, 특히 고령·거동불편 방문객을 동반한 가족은: '
        '- 어떤 프로그램·시설이 내 상황(건강 상태, 동반자, 날씨)에 맞는지 알기 어렵고 '
        '- 우천·혼잡 등 현장 변수를 고려한 안내를 받을 방법이 없고 '
        '- 추천을 받아도 "왜 이걸 추천하는지" 근거를 알 수 없어 신뢰하기 어렵고 '
        '- 예약 가능 여부를 확인하려면 각 시설에 따로 문의해야 했습니다. '
        '<b>그리고 온천 이후 "지역에서 무엇을 먹고 어디로 이동해야 할지"는 안내 범위 밖에 있었습니다.</b>',
        style_body))
    flow.append(Spacer(1, 22))

    flow.append(section_header('2', '무엇이 달라지나요?'))
    flow.append(Spacer(1, 10))
    p1 = Paragraph('<b>자연어로 상황을 한 번 말하면 끝</b>입니다. 나머지는 AI 에이전트가 온톨로지(지식그래프)를 스스로 탐색해 처리합니다.', style_body)
    flow.append(p1)
    flow.append(Spacer(1, 12))
    flow.append(highlight_box(
        '① 자연어 요청 입력  →  ② 의미 맥락 자동 생성(건강상태·날씨·혼잡도)<br/>'
        '→  ③ 지식그래프 탐색으로 위험·조건 확장  →  ④ 작업 분해 및 담당 에이전트 배정<br/>'
        '→  ⑤ 맞춤 프로그램·시설 추천  →  ⑥ 예약 가능 여부 자동 확인  →  ⑦ 근거와 함께 안내',
        bg=LIGHT_BLUE_BG, border=LIGHT_BLUE_BORDER, style=style_flow_center, border_side='BOX'))
    flow.append(Spacer(1, 14))

    compare_rows = [
        ('방문객이 직접 프로그램을 하나하나 검색', '상황을 말하면 AI가 맞춤 코스 자동 구성'),
        ('고령자·건강상태 고려 없는 일괄 안내', '무릎통증·보행불편 등 조건을 자동으로 위험·요구사항으로 확장'),
        ('날씨·혼잡도 변수 반영 불가', '우천 시 실내 대안 자동 우선순위 조정, 혼잡 시 예약 우선 안내'),
        ('추천 근거를 알 수 없는 블랙박스', '모든 추천이 실제 지식그래프 경로(근거 체인)로 설명 가능'),
        ('예약 가능 여부 별도 문의 필요', '추천과 동시에 예약 가능 여부 자동 확인'),
    ]
    flow.append(compare_table(compare_rows, '기존 방식', '이 서비스'))

    flow.append(PageBreak())

    # ============ Page 2: 3, 4, 5 섹션 ============
    flow.append(section_header('3', '무엇이 특별한가요? — "생각하는" 컨시어지'))
    flow.append(Spacer(1, 10))
    flow.append(Paragraph(
        '단순히 미리 정해진 답변을 골라주는 챗봇이 아닙니다. 온천단지에서 벌어지는 모든 상황을 '
        '<b>"조건 → 의미 확장 → 위험 → 담당 에이전트 → 추천 → 근거"</b>라는 하나의 논리 구조로 자동 연결하는 '
        '<b>운영 지식 엔진(Operational Ontology)</b>을 내장하고 있습니다.', style_body))
    flow.append(Spacer(1, 10))
    flow.append(Paragraph(
        '예를 들어 "무릎이 좋지 않은 78세 어머니를 모시고 우천 시 방문한다"는 요청이 들어오면, '
        '시스템은 다음을 자동으로 이해하고 기록합니다:', style_body))
    flow.append(Spacer(1, 10))
    flow.append(highlight_box(
        '"무릎 통증이 있다 → 이는 짧은 보행거리·낙상 위험 조건으로 의미 확장된다 → 비 오는 날씨는 실내 우선 '
        '조건으로 확장된다 → 이 조건들을 만족하는 프로그램은 저강도 실내 온천 코스다 → 이 프로그램은 낙상 '
        '위험을 완화한다 → 실내 온천탕은 예약 없이 이용 가능하다"',
        bg=ORANGE_BG, border=ORANGE_BORDER, style=style_quote, border_side='LEFT'))
    flow.append(Spacer(1, 10))
    flow.append(Paragraph(
        '이렇게 도출된 추천은 하드코딩된 규칙이 아니라, 실제 RDF/OWL 지식그래프의 트리플(관계)을 그래프 탐색으'
        '로 따라간 결과이므로, 왜 이 추천이 나왔는지 근거를 그대로 시민에게 보여줄 수 있습니다.', style_body))
    flow.append(Spacer(1, 22))

    flow.append(section_header('4', '5단계 에이전트 구조'))
    flow.append(Spacer(1, 10))
    flow.extend(bullets([
        '<b>의미 기반 Planner Agent</b>: 자연어 요청을 의미 맥락으로 변환, 지식그래프 탐색 총괄',
        '<b>관광 Agent</b>: 날씨·환경 조건이 프로그램에 미치는 영향 판단',
        '<b>안전 Agent</b>: 낙상·혼잡 등 안전 위험 요소 평가',
        '<b>방문객 응대 Agent</b>: 최종 맞춤 일정·프로그램 추천 생성',
        '<b>예약 Agent</b>: 추천 시설의 실시간 예약 가능 여부 확인',
    ]))
    flow.append(Spacer(1, 12))

    flow.append(section_header('5', '화면 미리보기'))
    flow.append(Spacer(1, 10))
    flow.extend(bullets([
        '<b>홈</b>: 온천단지 소개, 자주 묻는 상황 원터치 질문, 지식그래프 현황 요약',
        '<b>AI 컨시어지</b>: 자연어 채팅으로 상황 설명 → 위험 요소·추천 일정 즉시 확인',
        '<b>일정 상세</b>: 추천 프로그램·시설, 소요시간, 예약 가능 여부, 근거 체인(RDF 경로) 전체 열람',
        '<b>시설 지도</b>: 온천단지 내 시설 위치와 설명을 지도에서 확인',
        '<b>관리자</b>: 누적 요청·추천·예약 현황을 통계 대시보드로 실시간 확인',
        '<b>온톨로지 탐색기</b>: 서비스를 구동하는 지식그래프의 클래스·관계·개체를 직접 열람 (투명성 확보)',
    ]))

    flow.append(PageBreak())

    # ============ Page 3 (NEW): 실제 GPS 위치 기반 내 주변 식당 찾기 ============
    flow.append(new_section_header('6', '실제 GPS 위치 기반 \u201c내 주변 식당 찾기\u201d'))
    flow.append(Spacer(1, 10))
    flow.append(Paragraph(
        '온톨로지 기반 추천은 <b>가조 온천단지에 미리 등록된 시설·프로그램</b>을 대상으로 합니다. 하지만 방문객이 '
        '"온천 후 먹을 수 있는 지역 건강식 식당을 추천해주세요"처럼 <b>실제 세상의 식당</b>을 찾을 때는, '
        '방문객의 <b>실시간 GPS 위치</b>를 기준으로 진짜 지도 데이터를 조회해야 합니다. 이 기능은 온톨로지 추천 '
        '엔진과는 별도로 동작하는 <b>실시간 위치 기반 실세계 조회 레이어</b>로 새롭게 구현되었습니다.', style_body))
    flow.append(Spacer(1, 12))

    flow.append(highlight_box(
        '"온천 후 먹을 수 있는 지역 건강식 식당을 추천해주세요" → AI 컨시어지가 위치 기반 의도를 자동 인식 → '
        '"📍 실제 내 위치 기준으로 찾아드릴까요?" 버튼 제시 → 방문객 GPS 확인 동의 → 반경 내 식당을 '
        '건강식·한식·채식·해산물 등으로 자동 분류 → 카드 선택 시 지도에 경로 표시 → 카카오맵/네이버맵/구글맵 '
        '내비게이션으로 바로 연결',
        bg=GREEN_BG, border=GREEN_BORDER, style=style_quote, border_side='LEFT'))
    flow.append(Spacer(1, 14))

    flow.append(Paragraph('동작 흐름 (5단계)', style_body_bold))
    flow.append(Spacer(1, 6))
    flow.append(highlight_box(
        '① AI 채팅에서 위치 기반 맛집 의도 자동 감지  →  ② 방문객 GPS 위치 확인(권한 동의)<br/>'
        '→  ③ 반경 내 실제 식당을 카카오 로컬 API로 조회 및 카테고리 자동 분류<br/>'
        '→  ④ 지도에서 카드 선택 시 실시간 경로(도보/차량) 미리보기 표시<br/>'
        '→  ⑤ 카카오맵·네이버맵·구글맵 앱으로 원클릭 내비게이션 연동',
        bg=LIGHT_BLUE_BG, border=LIGHT_BLUE_BORDER, style=style_flow_center, border_side='BOX'))
    flow.append(Spacer(1, 16))

    flow.append(Paragraph('자동 분류되는 식당 카테고리', style_body_bold))
    flow.append(Spacer(1, 8))
    cat_rows = [
        ('🍲 건강식/약선', '약선, 한방, 건강식, 웰빙, 보양, 흑염소, 오리, 한정식 등 키워드 기반 자동 인식'),
        ('🥗 채식/사찰음식', '채식, 사찰음식, 비건, 템플스테이 연계 식당 등'),
        ('🍚 한식', '위 분류에 해당하지 않는 일반 한식·향토음식점'),
        ('🐟 해산물', '해물, 수산, 회, 장어, 민물장어, 매운탕, 어탕 등'),
        ('🍽️ 기타 음식점', '카페·프랜차이즈 등 그 외 모든 음식점'),
    ]
    cat_data = [[Paragraph('카테고리', style_table_header), Paragraph('분류 기준', style_table_header)]]
    for a, b in cat_rows:
        cat_data.append([Paragraph(a, style_table_cell), Paragraph(b, style_table_cell)])
    cat_table = Table(cat_data, colWidths=[CONTENT_W * 0.28, CONTENT_W * 0.72], repeatRows=1)
    cat_style = [
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#1B7A3D')),
        ('GRID', (0, 0), (-1, -1), 0.6, LIGHT_BLUE_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]
    for i in range(1, len(cat_data)):
        if i % 2 == 0:
            cat_style.append(('BACKGROUND', (0, i), (-1, i), TABLE_ALT_BG))
    cat_table.setStyle(TableStyle(cat_style))
    flow.append(cat_table)
    flow.append(Spacer(1, 16))

    flow.append(Paragraph('기술적 특징', style_body_bold))
    flow.append(Spacer(1, 6))
    flow.extend(bullets([
        '<b>실시간 GPS 연동</b>: 방문객의 브라우저 Geolocation API로 정확한 현재 위치를 확인 (위치 접근을 거부해도 가조 온천 중심좌표로 자동 대체)',
        '<b>카카오 로컬 API 기반 실제 데이터</b>: 온톨로지에 등록되지 않은 지역 내 모든 음식점을 실제 지도 데이터로 조회',
        '<b>경로 미리보기</b>: 오픈소스 라우팅 엔진(OSRM)으로 도보/차량 이동 경로와 예상 시간을 지도에 시각화',
        '<b>원클릭 내비게이션 연동</b>: 별도 내비게이션을 새로 개발하지 않고, 카카오맵·네이버맵·구글맵 등 방문객이 이미 쓰는 지도 앱으로 즉시 연결',
        '<b>대화 흐름과 자연스러운 통합</b>: AI 컨시어지 채팅, 일정 상세 화면, 홈 화면 빠른 질문 등 어디서든 한 번의 터치로 접근 가능',
    ]))
    flow.append(Spacer(1, 14))

    flow.append(compare_table([
        ('온톨로지에 등록된 시설·프로그램만 추천 가능', '등록 여부와 무관하게 방문객 주변의 실제 식당을 실시간으로 탐색'),
        ('추천 식당의 위치·거리를 알기 어려움', 'GPS 기반 정확한 거리·이동 시간 자동 계산'),
        ('식당까지 가는 길을 별도로 찾아야 함', '경로 미리보기 + 원클릭 내비게이션 연동으로 즉시 이동 가능'),
    ], '기존 (온톨로지 추천만)', '신규 (실시간 위치 기반 조회)'))

    flow.append(Spacer(1, 16))

    # ============ 7, 8, 9 섹션 (기존 6,7,8 재번호) — 자연스러운 흐름으로 이어서 배치 ============
    flow.append(section_header('7', '확장 가능성'))
    flow.append(Spacer(1, 8))
    flow.append(Paragraph(
        '지금은 온천단지 방문 컨시어지로 시작하지만, 같은 구조 그대로 확장 가능합니다: 지역 축제·둘레길 안내, 지자'
        '체 관광 통합 안내, 요양·복지시설 맞춤 안내 등 방문객의 상황(건강·환경·시간)을 고려해야 하는 다른 서비스 영'
        '역과 자연스럽게 연동될 수 있도록 설계되었습니다. <b>실시간 위치 기반 조회 레이어 역시 식당뿐 아니라 카페, '
        '약국, 편의점 등 다른 실세계 장소 검색으로 손쉽게 확장할 수 있습니다.</b>', style_body))
    flow.append(Spacer(1, 14))

    flow.append(section_header('8', '도입 시 기대 효과'))
    flow.append(Spacer(1, 8))
    flow.extend(bullets([
        '고령·거동불편 방문객에게 안전을 고려한 맞춤 코스 제공으로 만족도 향상',
        '날씨·혼잡도 등 현장 변수를 반영한 실시간 안내로 민원·불만 사전 예방',
        '모든 추천에 설명 가능한 근거를 제공해 방문객 신뢰도 확보',
        '프로그램·시설별 추천 이력 데이터 축적으로 향후 운영 개선 근거자료 확보',
        '예약 확인까지 한 번에 처리해 현장 문의 응대 부담 감소',
        '<b>온천 체험 이후의 식사·이동까지 안내 범위를 확장해 방문 전체 여정(End-to-End)의 만족도 향상</b>',
    ], style=ParagraphStyle('bullet_tight', parent=style_bullet, spaceAfter=0, leading=15)))
    flow.append(Spacer(1, 14))

    flow.append(section_header('9', '현재 상태'))
    flow.append(Spacer(1, 8))
    flow.extend(bullets([
        '실제 동작하는 데모 서비스 운영 중 (모바일 웹 앱, PWA로 설치 없이 바로 사용)',
        '홈 / AI 컨시어지 / 일정 상세 / 시설 지도 / 관리자 대시보드 / 온톨로지 탐색기 6개 화면 모두 구현 완료',
        '거창 가조 온천단지 전용 지식그래프(운영 온톨로지 + 가조 도메인 온톨로지) 기반으로 동작 중',
        '다른 지역·시설로 확장 시, 해당 지역의 지식그래프(TTL 파일)만 교체하면 즉시 적용 가능',
        '<b>실시간 GPS 위치 기반 \u201c내 주변 식당 찾기\u201d 기능 구현 완료</b> (카카오 로컬 API 연동, 서비스 심사 진행 중)',
    ], style=ParagraphStyle('bullet_tight2', parent=style_bullet, spaceAfter=0, leading=15)))
    flow.append(Spacer(1, 12))
    flow.append(HRFlowable(width=CONTENT_W, thickness=0.6, color=LIGHT_BLUE_BORDER, spaceBefore=0, spaceAfter=10))
    flow.append(Paragraph('<b>문의</b>: 시범 도입, 맞춤 설정(지역 시설·프로그램 반영), 상세 시연 요청 시 별도 연락 바랍니다.', style_body))

    doc.build(flow)


if __name__ == '__main__':
    build_pdf('/home/user/webapp/docs/가조AI컨시어지_소개자료.pdf')
    print('PDF generated.')
